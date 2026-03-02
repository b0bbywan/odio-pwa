import { describe, test, expect, vi, beforeEach } from 'vitest';
import { getInstanceUiUrl, probeInstance } from './api';

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
