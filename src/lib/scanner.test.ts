import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { OdioInstance, OdioServerInfo } from './types';

// The network probes are mocked; parsing and network lists stay real.
vi.mock('./scan', async (importOriginal) => ({
	...(await importOriginal<typeof import('./scan')>()),
	findActiveNetworks: vi.fn(),
	scanHosts: vi.fn(),
}));

import { Scanner } from './scanner.svelte';
import { candidateNetworks, findActiveNetworks, scanHosts, sweepNetworks, type ScanResult } from './scan';

const info: OdioServerInfo = {
	hostname: 'raspi-salon',
	os_platform: 'linux',
	os_version: '6.1',
	api_sw: 'odio-api',
	api_version: '1.4.0',
	backends: { mpris: true, pulseaudio: true, systemd: true, zeroconf: false },
};

const kitchen: OdioInstance = { id: 'k', host: '192.168.1.57', port: 8018, label: 'kitchen', status: 'online' };
const salon: ScanResult = { host: '192.168.1.23', info };

// scanHosts reports these hosts, then the whole list as probed.
function scanFinds(...found: ScanResult[]) {
	vi.mocked(scanHosts).mockImplementation(async (hosts, _port, { onFound, onProgress }) => {
		found.forEach(onFound);
		onProgress(hosts.length);
	});
}

function pending<T>(): Promise<T> {
	return new Promise(() => {});
}

beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(findActiveNetworks).mockResolvedValue([]);
	scanFinds();
});

// ── target ────────────────────────────────────────────────────────────────────

describe('Scanner — target', () => {
	test('an invalid target sets the error and scans nothing', async () => {
		const scanner = new Scanner();
		scanner.target = '10.0.0.0/16';
		await scanner.start([]);
		expect(scanner.error).toBe('Network too large (max /22)');
		expect(scanner.phase).toBe('form');
		expect(scanHosts).not.toHaveBeenCalled();
	});

	test('a target is scanned as given, on the chosen port', async () => {
		const scanner = new Scanner();
		scanner.target = ' 10.0.0.0/30 ';
		scanner.port = 8080;
		scanFinds(salon);
		await scanner.start([kitchen]);
		expect(scanHosts).toHaveBeenCalledWith(['10.0.0.1', '10.0.0.2'], 8080, expect.anything());
		expect(findActiveNetworks).not.toHaveBeenCalled();
		expect(scanner).toMatchObject({
			phase: 'done',
			scope: '10.0.0.0/30',
			progress: { done: 2, total: 2 },
			results: [salon],
			steps: [],
		});
	});

	test('a new scan clears the previous error and results', async () => {
		const scanner = new Scanner();
		scanner.target = 'nope/24';
		await scanner.start([]);
		scanner.target = '10.0.0.1';
		scanFinds(salon);
		await scanner.start([]);
		expect(scanner.error).toBe('');
		scanFinds();
		await scanner.start([]);
		expect(scanner.results).toEqual([]);
	});

	test('counts the hosts that answer without allowing this origin', async () => {
		vi.mocked(scanHosts).mockImplementation(async (_hosts, _port, { onBlocked }) => {
			onBlocked?.('10.0.0.1');
			onBlocked?.('10.0.0.2');
		});
		const scanner = new Scanner();
		scanner.target = '10.0.0.0/30';
		await scanner.start([]);
		expect(scanner.blocked).toBe(2);
		scanFinds();
		await scanner.start([]);
		expect(scanner.blocked).toBe(0);
	});
});

// ── no target ─────────────────────────────────────────────────────────────────

describe('Scanner — no target', () => {
	test('with an instance online, its /24 is scanned straight away', async () => {
		const scanner = new Scanner();
		await scanner.start([kitchen, { ...kitchen, id: 'l', host: 'localhost', label: 'Local' }]);
		expect(findActiveNetworks).not.toHaveBeenCalled();
		const hosts = vi.mocked(scanHosts).mock.calls[0][0];
		expect(hosts).toHaveLength(254);
		expect(hosts[0]).toBe('192.168.1.1');
		expect(scanner.scope).toBe('192.168.1.0/24');
		expect(scanner.steps).toEqual([{ label: 'Network of kitchen', detail: '192.168.1.0/24' }]);
	});

	test('with no instance online, the common networks are checked first', async () => {
		vi.mocked(findActiveNetworks).mockResolvedValue(['192.168.1.0/24']);
		const scanner = new Scanner();
		await scanner.start([{ ...kitchen, status: 'offline' }]);
		expect(findActiveNetworks).toHaveBeenCalledExactlyOnceWith(
			candidateNetworks(['192.168.1.57']),
			8018,
			expect.objectContaining({ samples: 3 }),
		);
		expect(vi.mocked(scanHosts).mock.calls[0][0]).toHaveLength(254);
		expect(scanner.steps).toEqual([{ label: 'Network found', detail: '192.168.1.0/24' }]);
	});

	test('when none is active, the rest of 192.168.0.0/16 is swept', async () => {
		vi.mocked(findActiveNetworks).mockResolvedValueOnce([]).mockResolvedValueOnce(['192.168.7.0/24']);
		const scanner = new Scanner();
		await scanner.start([]);
		expect(findActiveNetworks).toHaveBeenLastCalledWith(
			sweepNetworks(candidateNetworks([])),
			8018,
			expect.objectContaining({ samples: 2 }),
		);
		expect(scanner.scope).toBe('192.168.7.0/24');
	});

	test('several active networks are scanned together', async () => {
		vi.mocked(findActiveNetworks).mockResolvedValue(['192.168.1.0/24', '10.0.0.0/24']);
		const scanner = new Scanner();
		await scanner.start([]);
		expect(vi.mocked(scanHosts).mock.calls[0][0]).toHaveLength(508);
		expect(scanner.scope).toBe('192.168.1.0/24, 10.0.0.0/24');
		expect(scanner.steps).toEqual([{ label: 'Networks found', detail: '192.168.1.0/24, 10.0.0.0/24' }]);
	});

	test('no active network ends without scanning', async () => {
		const scanner = new Scanner();
		await scanner.start([]);
		expect(scanHosts).not.toHaveBeenCalled();
		expect(scanner).toMatchObject({
			phase: 'done',
			scope: '',
			steps: [
				{ label: 'Common networks', detail: 'none active' },
				{ label: '192.168.0.0/16', detail: 'none active' },
			],
		});
	});
});

// ── progress ──────────────────────────────────────────────────────────────────

describe('Scanner — progress', () => {
	test('follows the network search', async () => {
		vi.mocked(findActiveNetworks).mockImplementation((networks, _port, { onProgress }) => {
			onProgress?.(14);
			return networks.length === 39 ? pending() : Promise.resolve([]);
		});
		const scanner = new Scanner();
		scanner.start([]);
		expect(scanner).toMatchObject({
			phase: 'running',
			running: 'Checking common networks…',
			progress: { done: 14, total: 39 },
		});
	});

	test('follows the scan', async () => {
		vi.mocked(scanHosts).mockImplementation((_hosts, _port, { onFound, onProgress }) => {
			onFound(salon);
			onProgress(112);
			return pending();
		});
		const scanner = new Scanner();
		scanner.target = '192.168.1.0/24';
		scanner.start([]);
		expect(scanner).toMatchObject({
			phase: 'running',
			running: 'Scanning 192.168.1.0/24…',
			progress: { done: 112, total: 254 },
			results: [salon],
		});
	});
});

// ── stop ──────────────────────────────────────────────────────────────────────

describe('Scanner — stop', () => {
	test('while looking for a network, goes back to the form', async () => {
		vi.mocked(findActiveNetworks).mockReturnValue(pending());
		const scanner = new Scanner();
		scanner.start([]);
		scanner.stop();
		expect(scanner.phase).toBe('form');
		expect(vi.mocked(findActiveNetworks).mock.calls[0][2].signal.aborted).toBe(true);
	});

	test('during the scan, keeps what was found', async () => {
		vi.mocked(scanHosts).mockImplementation((_hosts, _port, { onFound }) => {
			onFound(salon);
			return pending();
		});
		const scanner = new Scanner();
		scanner.target = '192.168.1.0/24';
		scanner.start([]);
		scanner.stop();
		expect(scanner).toMatchObject({ phase: 'done', results: [salon] });
		expect(vi.mocked(scanHosts).mock.calls[0][2].signal.aborted).toBe(true);
	});

	test('a scan that ends after being stopped changes nothing', async () => {
		let finish!: () => void;
		vi.mocked(findActiveNetworks).mockReturnValue(new Promise((resolve) => (finish = () => resolve(['192.168.1.0/24']))));
		const scanner = new Scanner();
		const started = scanner.start([]);
		scanner.stop();
		finish();
		await started;
		expect(scanner.phase).toBe('form');
		expect(scanHosts).not.toHaveBeenCalled();
	});

	test('edit goes back to the form, keeping the target', async () => {
		const scanner = new Scanner();
		scanner.target = '192.168.1.0/24';
		await scanner.start([]);
		scanner.edit();
		expect(scanner).toMatchObject({ phase: 'form', target: '192.168.1.0/24' });
	});
});
