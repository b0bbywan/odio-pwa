import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./api', async (importOriginal) => ({
	...(await importOriginal<typeof import('./api')>()),
	probeInstance: vi.fn(),
	probeReachable: vi.fn(),
}));

import {
	candidateNetworks,
	findActiveNetworks,
	networksOf,
	parseScanTarget,
	scanHosts,
	sweepNetworks,
} from './scan';
import { probeInstance, probeReachable } from './api';

const mockInfo = {
	hostname: 'raspi',
	os_platform: 'linux',
	os_version: '6.1',
	api_sw: 'odio-api',
	api_version: '1.0.0',
	backends: { mpris: true, pulseaudio: true, systemd: true, zeroconf: false },
};

function hostsOf(input: string): string[] {
	const parsed = parseScanTarget(input);
	if ('error' in parsed) throw new Error(parsed.error);
	return parsed.hosts;
}

describe('parseScanTarget', () => {
	test('a single IP or hostname is one host', () => {
		expect(hostsOf('192.168.1.42')).toEqual(['192.168.1.42']);
		expect(hostsOf('  odio.local ')).toEqual(['odio.local']);
	});

	test('empty input is an error', () => {
		expect(parseScanTarget('  ')).toEqual({ error: 'Enter an IP or a network' });
	});

	test('a /24 skips the network and broadcast addresses', () => {
		const hosts = hostsOf('192.168.1.0/24');
		expect(hosts).toHaveLength(254);
		expect(hosts[0]).toBe('192.168.1.1');
		expect(hosts.at(-1)).toBe('192.168.1.254');
	});

	test('a dotted mask is the same as its prefix', () => {
		expect(hostsOf('192.168.1.0/255.255.255.0')).toEqual(hostsOf('192.168.1.0/24'));
		expect(hostsOf('10.0.0.0/255.255.252.0')).toHaveLength(1022);
	});

	test('the address is aligned on the network', () => {
		expect(hostsOf('192.168.1.77/24')).toEqual(hostsOf('192.168.1.0/24'));
	});

	test('/31 and /32 keep every address', () => {
		expect(hostsOf('10.0.0.5/32')).toEqual(['10.0.0.5']);
		expect(hostsOf('10.0.0.5/31')).toEqual(['10.0.0.4', '10.0.0.5']);
	});

	test('networks larger than /22 are refused', () => {
		expect(parseScanTarget('10.0.0.0/21')).toEqual({ error: 'Network too large (max /22)' });
		expect(parseScanTarget('10.0.0.0/255.255.0.0')).toEqual({ error: 'Network too large (max /22)' });
	});

	test.each(['300.1.1.0/24', '192.168.1/24', '192.168.1.0/33', '192.168.1.0/255.0.255.0', '192.168.1.0/'])(
		'%s is invalid',
		(input) => {
			expect(parseScanTarget(input)).toEqual({ error: 'Invalid network' });
		},
	);
});

describe('networksOf', () => {
	test('is the /24 of each IPv4 host, without duplicates', () => {
		expect(networksOf(['192.168.1.57', '10.0.0.3', '192.168.1.23'])).toEqual([
			'192.168.1.0/24',
			'10.0.0.0/24',
		]);
	});

	test('skips hostnames', () => {
		expect(networksOf(['odio.local', 'localhost'])).toEqual([]);
	});
});

describe('candidateNetworks', () => {
	test('known IPv4 networks come first, without duplicates', () => {
		const networks = candidateNetworks(['192.168.42.10', 'odio.local', '192.168.42.11', '192.168.0.3']);
		expect(networks[0]).toBe('192.168.42.0/24');
		expect(networks[1]).toBe('192.168.0.0/24');
		expect(networks).toContain('192.168.1.0/24');
		expect(new Set(networks).size).toBe(networks.length);
	});

	test('includes defaults outside 192.168.0.0/16', () => {
		const networks = candidateNetworks([]);
		expect(networks).toContain('192.168.254.0/24');
		expect(networks).toContain('172.30.1.0/24');
		expect(networks).toContain('172.20.10.0/28');
	});
});

describe('sweepNetworks', () => {
	test('is the rest of 192.168.0.0/16', () => {
		const candidates = candidateNetworks(['192.168.42.10']);
		const sweep = sweepNetworks(candidates);
		expect(sweep).toContain('192.168.7.0/24');
		expect(sweep).not.toContain('192.168.1.0/24');
		expect(sweep).not.toContain('192.168.42.0/24');
		const all = new Set([...candidates, ...sweep].filter((n) => n.startsWith('192.168.')));
		expect(all.size).toBe(256);
		expect(candidates.length + sweep.length).toBe(256 + 7);
	});
});

describe('findActiveNetworks', () => {
	// fetch hangs until aborted, like a network that isn't routed, unless
	// `answer` decides otherwise for the host.
	function stubFetch(answer: (host: string) => Promise<unknown> | undefined) {
		vi.stubGlobal(
			'fetch',
			vi.fn((url: string, init: RequestInit) => {
				const result = answer(new URL(url).hostname);
				if (result) return result;
				return new Promise((_, reject) => {
					init.signal!.addEventListener('abort', () => reject(init.signal!.reason));
				});
			}),
		);
	}

	afterEach(() => vi.unstubAllGlobals());

	test('a network failing fast (unassigned IP) is active', async () => {
		stubFetch((host) =>
			host.startsWith('192.168.1.') ? Promise.reject(new TypeError('Failed to fetch')) : undefined,
		);
		const active = await findActiveNetworks(['192.168.0.0/24', '192.168.1.0/24'], 8018, {
			signal: new AbortController().signal,
			timeoutMs: 20,
		});
		expect(active).toEqual(['192.168.1.0/24']);
	});

	test('a network where a host answers is active', async () => {
		stubFetch((host) => (host === '10.0.0.1' ? Promise.resolve(new Response()) : undefined));
		const active = await findActiveNetworks(['10.0.0.0/24'], 8018, {
			signal: new AbortController().signal,
			timeoutMs: 20,
		});
		expect(active).toEqual(['10.0.0.0/24']);
	});

	function probedHosts(): string[] {
		return vi.mocked(fetch).mock.calls.map(([url]) => new URL(String(url)).hostname);
	}

	function lastOctets(): number[] {
		return probedHosts().map((host) => Number(host.split('.')[3]));
	}

	test('samples two high hosts and the gateway, on the scan port', async () => {
		stubFetch(() => undefined);
		await findActiveNetworks(['10.0.0.0/24'], 8080, {
			signal: new AbortController().signal,
			timeoutMs: 20,
		});
		expect(String(vi.mocked(fetch).mock.calls[0][0])).toMatch(/^http:\/\/10\.0\.0\.\d+:8080\/$/);
		const octets = lastOctets();
		expect(octets).toHaveLength(3);
		expect(octets[2]).toBe(1);
		for (const octet of octets.slice(0, 2)) {
			expect(octet).toBeGreaterThanOrEqual(192);
			expect(octet).toBeLessThanOrEqual(254);
		}
	});

	test('with two samples the gateway is left out', async () => {
		stubFetch(() => undefined);
		await findActiveNetworks(['10.0.0.0/24'], 8018, {
			signal: new AbortController().signal,
			samples: 2,
			timeoutMs: 20,
		});
		expect(lastOctets()).toHaveLength(2);
		expect(lastOctets()).not.toContain(1);
	});

	test('samples stay inside a network smaller than a /24', async () => {
		stubFetch(() => undefined);
		await findActiveNetworks(['172.20.10.0/28'], 8018, {
			signal: new AbortController().signal,
			timeoutMs: 20,
		});
		const octets = lastOctets();
		expect(octets[2]).toBe(1);
		for (const octet of octets.slice(0, 2)) {
			expect(octet).toBeGreaterThanOrEqual(12);
			expect(octet).toBeLessThanOrEqual(14);
		}
	});

	test('reports each network once all its samples are in', async () => {
		stubFetch(() => undefined);
		const onProgress = vi.fn();
		await findActiveNetworks(['10.0.0.0/24', '10.0.1.0/24'], 8018, {
			signal: new AbortController().signal,
			onProgress,
			timeoutMs: 20,
		});
		expect(onProgress.mock.calls).toEqual([[1], [2]]);
	});

	test('never runs more than 192 probes at once', async () => {
		let inFlight = 0;
		let peak = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				peak = Math.max(peak, ++inFlight);
				await new Promise((r) => setTimeout(r, 1));
				inFlight--;
				throw new DOMException('timed out', 'TimeoutError');
			}),
		);
		const active = await findActiveNetworks(sweepNetworks([]), 8018, {
			signal: new AbortController().signal,
			samples: 2,
		});
		expect(active).toEqual([]);
		expect(fetch).toHaveBeenCalledTimes(512);
		expect(peak).toBe(192);
	});

	test('nothing is active once aborted', async () => {
		stubFetch(() => undefined);
		const controller = new AbortController();
		const pending = findActiveNetworks(['10.0.0.0/24'], 8018, { signal: controller.signal });
		controller.abort();
		expect(await pending).toEqual([]);
	});
});

describe('scanHosts', () => {
	beforeEach(() => {
		vi.mocked(probeInstance).mockReset();
		vi.mocked(probeReachable).mockReset();
	});

	test('reports odio-api hosts and progress', async () => {
		vi.mocked(probeInstance).mockImplementation((host) =>
			host === '10.0.0.2' ? Promise.resolve(mockInfo) : Promise.reject(new Error('down')),
		);
		const onFound = vi.fn();
		const onProgress = vi.fn();
		await scanHosts(hostsOf('10.0.0.0/29'), 8018, {
			signal: new AbortController().signal,
			onFound,
			onProgress,
		});
		expect(onFound).toHaveBeenCalledExactlyOnceWith({ host: '10.0.0.2', info: mockInfo });
		expect(onProgress).toHaveBeenCalledTimes(6);
		expect(onProgress).toHaveBeenLastCalledWith(6);
		expect(probeInstance).toHaveBeenCalledWith('10.0.0.2', 8018, 1500);
	});

	test('reports the hosts that answer without allowing this origin', async () => {
		// .1 refuses the connection, .2 answers behind CORS, .3 isn't there
		// and .4 answers something that isn't odio-api.
		vi.mocked(probeInstance).mockImplementation((host) =>
			Promise.reject(
				host === '10.0.0.3'
					? new DOMException('timed out', 'TimeoutError')
					: host === '10.0.0.4'
						? new Error('HTTP 404')
						: new TypeError('Failed to fetch'),
			),
		);
		vi.mocked(probeReachable).mockImplementation(async (host) => host === '10.0.0.2');
		const onBlocked = vi.fn();
		const onProgress = vi.fn();
		await scanHosts(['10.0.0.1', '10.0.0.2', '10.0.0.3', '10.0.0.4'], 8018, {
			signal: new AbortController().signal,
			onFound: vi.fn(),
			onBlocked,
			onProgress,
		});
		expect(onBlocked).toHaveBeenCalledExactlyOnceWith('10.0.0.2');
		expect(vi.mocked(probeReachable).mock.calls).toEqual([
			['10.0.0.1', 8018, 1500],
			['10.0.0.2', 8018, 1500],
		]);
		expect(onProgress).toHaveBeenLastCalledWith(4);
	});

	test('never runs more than `concurrency` probes at once', async () => {
		let inFlight = 0;
		let peak = 0;
		vi.mocked(probeInstance).mockImplementation(async () => {
			peak = Math.max(peak, ++inFlight);
			await new Promise((r) => setTimeout(r, 1));
			inFlight--;
			throw new Error('down');
		});
		await scanHosts(hostsOf('10.0.0.0/24'), 8018, {
			signal: new AbortController().signal,
			onFound: vi.fn(),
			onProgress: vi.fn(),
			concurrency: 8,
		});
		expect(peak).toBe(8);
		expect(probeInstance).toHaveBeenCalledTimes(254);
	});

	test('stops picking hosts once aborted and drops in-flight results', async () => {
		const controller = new AbortController();
		vi.mocked(probeInstance).mockImplementation(async () => {
			controller.abort();
			return mockInfo;
		});
		const onFound = vi.fn();
		await scanHosts(hostsOf('10.0.0.0/24'), 8018, {
			signal: controller.signal,
			onFound,
			onProgress: vi.fn(),
			concurrency: 4,
		});
		// The first probe aborts before the other workers pick a host.
		expect(probeInstance).toHaveBeenCalledTimes(1);
		expect(onFound).not.toHaveBeenCalled();
	});
});
