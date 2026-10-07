import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
	fetchPlayers,
	fetchPowerCapabilities,
	getInstanceUiUrl,
	getPlayerCoverUrl,
	probeInstance,
	sendPlayerAction,
	sendPowerAction,
} from './api';

describe('getInstanceUiUrl', () => {
	test('builds the correct UI URL', () => {
		expect(getInstanceUiUrl('192.168.1.1', 8080)).toBe('http://192.168.1.1:8080/ui');
	});
});

describe('probeInstance', () => {
	const mockInfo = {
		hostname: 'raspi',
		os_platform: 'linux',
		os_version: '6.1',
		api_sw: 'odio-api',
		api_version: '1.0.0',
		backends: { mpris: true, pulseaudio: true, systemd: true, zeroconf: false },
	};

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	test('returns parsed server info on success', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(mockInfo) }),
		);
		const result = await probeInstance('192.168.1.1', 8080);
		expect(result).toEqual(mockInfo);
		expect(fetch).toHaveBeenCalledWith(
			'http://192.168.1.1:8080/server',
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
	});

	test('throws on non-200 response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
		await expect(probeInstance('192.168.1.1', 8080)).rejects.toThrow('HTTP 503');
	});

	test('throws on network failure', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
		await expect(probeInstance('192.168.1.1', 8080)).rejects.toThrow('Network error');
	});

	test('uses a custom timeout', async () => {
		let capturedSignal: AbortSignal | undefined;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((_url, opts) => {
				capturedSignal = opts.signal;
				return Promise.resolve({ ok: true, json: () => Promise.resolve(mockInfo) });
			}),
		);
		await probeInstance('192.168.1.1', 8080, 500);
		expect(capturedSignal).toBeDefined();
		expect(capturedSignal!.aborted).toBe(false);
	});
});

describe('fetchPlayers', () => {
	const players = [
		{
			bus_name: 'org.mpris.MediaPlayer2.mpd',
			identity: 'Music Player Daemon',
			playback_status: 'Playing',
			position_updated_at: '2026-10-06T23:42:48.826+02:00',
			capabilities: {
				can_play: true,
				can_pause: true,
				can_go_next: false,
				can_go_previous: true,
				can_seek: false,
				can_control: true,
			},
		},
	];

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	test('returns parsed players on success', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(players) }),
		);
		expect(await fetchPlayers('raspodio.local', 8018)).toEqual(players);
		expect(vi.mocked(fetch).mock.calls[0][0]).toBe('http://raspodio.local:8018/players');
	});

	test('throws on non-200 response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
		await expect(fetchPlayers('raspodio.local', 8018)).rejects.toThrow('HTTP 404');
	});
});

describe('sendPlayerAction', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	test('POSTs to the action endpoint with an encoded bus name', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 202 }));
		await sendPlayerAction('raspodio.local', 8018, 'org.mpris.MediaPlayer2.mpd', 'play_pause');
		expect(fetch).toHaveBeenCalledWith(
			'http://raspodio.local:8018/players/org.mpris.MediaPlayer2.mpd/play_pause',
			{ method: 'POST' },
		);
	});

	test('throws on non-2xx response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
		await expect(
			sendPlayerAction('raspodio.local', 8018, 'org.mpris.MediaPlayer2.mpd', 'next'),
		).rejects.toThrow('HTTP 500');
	});
});

describe('fetchPowerCapabilities', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	test('returns the parsed capabilities', async () => {
		const caps = { reboot: true, power_off: false };
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(caps) }),
		);
		expect(await fetchPowerCapabilities('raspodio.local', 8018)).toEqual(caps);
		expect(vi.mocked(fetch).mock.calls[0][0]).toBe('http://raspodio.local:8018/power');
	});

	test('throws on non-2xx response', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
		await expect(fetchPowerCapabilities('raspodio.local', 8018)).rejects.toThrow('HTTP 404');
	});
});

describe('sendPowerAction', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	test('POSTs to the action endpoint', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 202 }));
		await sendPowerAction('raspodio.local', 8018, 'power_off');
		expect(fetch).toHaveBeenCalledWith('http://raspodio.local:8018/power/power_off', {
			method: 'POST',
		});
	});

	test('throws when login1 refuses the action', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }));
		await expect(sendPowerAction('raspodio.local', 8018, 'reboot')).rejects.toThrow('HTTP 403');
	});
});

describe('getPlayerCoverUrl', () => {
	test('points at the cover endpoint with the art URL as cache-buster', () => {
		expect(
			getPlayerCoverUrl(
				'raspodio.local',
				8018,
				'org.mpris.MediaPlayer2.mpd',
				'https://example.com/a b.webp',
			),
		).toBe(
			'http://raspodio.local:8018/players/org.mpris.MediaPlayer2.mpd/cover?art=https%3A%2F%2Fexample.com%2Fa%20b.webp',
		);
	});
});
