import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createConnection, GIVE_UP_AFTER_MS } from './connection';

vi.mock('./sse', () => ({ connectSSE: vi.fn() }));
vi.mock('./api', () => ({ probeInstance: vi.fn() }));

import { connectSSE } from './sse';
import { probeInstance } from './api';

const mockInfo = {
	hostname: 'raspi',
	os_platform: 'linux',
	os_version: '6.1',
	api_sw: 'odio-api',
	api_version: '1.0.0',
	backends: { mpris: false, pulseaudio: false, systemd: false, zeroconf: false },
};

function makeCallbacks() {
	return {
		onStatus: vi.fn(),
		onServerInfo: vi.fn(),
		onGiveUp: vi.fn(),
		onPowerAction: vi.fn(),
	};
}

type CapturedSSE = {
	onOpen: () => void;
	onAlive: () => void;
	onOffline: () => void;
	cleanup: ReturnType<typeof vi.fn>;
};
let capturedSSE: CapturedSSE | null = null;

function setupConnectSSE() {
	vi.mocked(connectSSE).mockImplementation((_host, _port, onOpen, onAlive, onOffline) => {
		const cleanup = vi.fn();
		capturedSSE = { onOpen, onAlive, onOffline, cleanup };
		return cleanup;
	});
}

// Works with real timers — drains the microtask queue via a real setTimeout
function flush(): Promise<void> {
	return new Promise((r) => setTimeout(r, 0));
}

// Works with fake timers — drains microtasks without relying on setTimeout
async function drainMicrotasks(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
}

beforeEach(() => {
	vi.clearAllMocks();
	capturedSSE = null;
	vi.mocked(probeInstance).mockResolvedValue(mockInfo);
	setupConnectSSE();
});

afterEach(() => {
	vi.useRealTimers();
});

// ── probe path ────────────────────────────────────────────────────────────────

describe('createConnection — probe success', () => {
	test('calls onStatus(probing) synchronously', () => {
		const cb = makeCallbacks();
		createConnection('h', 8080, cb);
		expect(cb.onStatus).toHaveBeenCalledWith('probing');
	});

	test('calls onServerInfo and onStatus(online) after probe resolves', async () => {
		const cb = makeCallbacks();
		createConnection('h', 8080, cb);
		await flush();
		expect(cb.onServerInfo).toHaveBeenCalledWith(mockInfo);
		expect(cb.onStatus).toHaveBeenCalledWith('online');
	});

	test('opens SSE after probe succeeds', async () => {
		const cb = makeCallbacks();
		createConnection('h', 8080, cb);
		await flush();
		expect(connectSSE).toHaveBeenCalledOnce();
	});

	test('forwards onPowerAction to connectSSE', async () => {
		const cb = makeCallbacks();
		createConnection('h', 8080, cb);
		await flush();
		expect(vi.mocked(connectSSE).mock.calls[0][5]?.onPowerAction).toBe(cb.onPowerAction);
	});
});

// ── probe failure & backoff ───────────────────────────────────────────────────

describe('createConnection — probe failure', () => {
	test('calls onStatus(offline) when probe fails', async () => {
		vi.mocked(probeInstance).mockRejectedValue(new Error('down'));
		const cb = makeCallbacks();
		createConnection('h', 8080, cb);
		await flush();
		expect(cb.onStatus).toHaveBeenCalledWith('offline');
		expect(connectSSE).not.toHaveBeenCalled();
	});

	test('retries after backoff on probe failure', async () => {
		vi.useFakeTimers();
		vi.mocked(probeInstance).mockRejectedValue(new Error('down'));
		const cb = makeCallbacks();
		createConnection('h', 8080, cb);
		await drainMicrotasks(); // let the initial probe rejection settle
		expect(cb.onStatus).toHaveBeenCalledWith('offline');
		// After 1s backoff, probe is retried
		vi.mocked(probeInstance).mockResolvedValue(mockInfo);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(cb.onStatus).toHaveBeenCalledWith('online');
	});

	test('backoff doubles on each failure', async () => {
		vi.useFakeTimers();
		vi.mocked(probeInstance).mockRejectedValue(new Error('down'));
		const cb = makeCallbacks();
		createConnection('h', 8080, cb);
		// 1st attempt: probing → offline, schedules retry at 1s (backoff → 2s)
		await drainMicrotasks();
		// 2nd attempt (retry): no probing flash, stays offline, schedules at 2s (backoff → 4s)
		await vi.advanceTimersByTimeAsync(1_000);
		// 3rd attempt (retry): same, schedules at 4s (backoff → 8s)
		await vi.advanceTimersByTimeAsync(2_000);
		// 4th hasn't fired yet (needs 4 more seconds)
		// Only 1 'probing' call (first attempt), then 3 'offline' calls
		expect(cb.onStatus.mock.calls.filter(([s]) => s === 'probing')).toHaveLength(1);
		expect(cb.onStatus.mock.calls.filter(([s]) => s === 'offline')).toHaveLength(3);
	});

	test('gives up after GIVE_UP_AFTER_MS of consecutive failures', async () => {
		vi.useFakeTimers();
		vi.mocked(probeInstance).mockRejectedValue(new Error('down'));
		const cb = makeCallbacks();
		createConnection('h', 8080, cb);
		await vi.advanceTimersByTimeAsync(GIVE_UP_AFTER_MS + 1_000);
		expect(cb.onGiveUp).toHaveBeenCalledOnce();
	});

	test('destroy cancels pending retry timer', async () => {
		vi.useFakeTimers();
		vi.mocked(probeInstance).mockRejectedValue(new Error('down'));
		const cb = makeCallbacks();
		const destroy = createConnection('h', 8080, cb);
		await drainMicrotasks();
		destroy();
		await vi.advanceTimersByTimeAsync(10_000);
		// No additional probing after destroy
		expect(probeInstance).toHaveBeenCalledOnce();
	});
});

// ── SSE disconnect & retry ────────────────────────────────────────────────────

describe('createConnection — SSE disconnect', () => {
	test('closes SSE and schedules retry on disconnect', async () => {
		const cb = makeCallbacks();
		createConnection('h', 8080, cb);
		await flush();
		const { onOpen, onOffline, cleanup } = capturedSSE!;
		await onOpen(); // SSE was open before dropping
		onOffline();
		expect(cleanup).toHaveBeenCalledOnce();
		expect(cb.onStatus).toHaveBeenCalledWith('offline');
	});

	test('retries with probe + SSE after backoff following disconnect', async () => {
		vi.useFakeTimers();
		const cb = makeCallbacks();
		createConnection('h', 8080, cb);
		await drainMicrotasks(); // initial probe → SSE setup
		capturedSSE!.onOpen(); // SSE opened → sseEverOpened = true (sync)
		capturedSSE!.onOffline(); // transient disconnect
		await vi.advanceTimersByTimeAsync(1_000); // backoff fires → reprobe → SSE reopened
		expect(connectSSE).toHaveBeenCalledTimes(2);
	});

	test('resets failure tracking when SSE onOpen fires', async () => {
		vi.useFakeTimers();
		vi.mocked(probeInstance).mockRejectedValue(new Error('down'));
		const cb = makeCallbacks();
		createConnection('h', 8080, cb);
		await drainMicrotasks(); // 1st probe fails
		// Server comes back
		vi.mocked(probeInstance).mockResolvedValue(mockInfo);
		await vi.advanceTimersByTimeAsync(1_000); // retry → probe ok → SSE opened
		capturedSSE!.onOpen(); // SSE confirms open → resets failingSince (sync)
		expect(cb.onGiveUp).not.toHaveBeenCalled();
	});
});

// ── SSE not supported (error before first open) ───────────────────────────────

describe('createConnection — SSE unsupported', () => {
	test('falls back to probe-only when SSE errors before first open', async () => {
		vi.useFakeTimers();
		const cb = makeCallbacks();
		createConnection('h', 8080, cb);
		await drainMicrotasks(); // probe ok → SSE opened → immediately errors (no onOpen)
		capturedSSE!.onOffline(); // SSE error before onOpen → not supported
		// Probe already succeeded → status stays 'online', no red flash
		expect(cb.onStatus).not.toHaveBeenCalledWith('offline');
		// After backoff, retries as probe-only (no new SSE)
		await vi.advanceTimersByTimeAsync(1_000);
		expect(connectSSE).toHaveBeenCalledOnce(); // no second SSE attempt
		expect(cb.onStatus).toHaveBeenCalledWith('online');
	});

	test('probe failure does not disable SSE support', async () => {
		vi.useFakeTimers();
		vi.mocked(probeInstance).mockRejectedValue(new Error('down'));
		const cb = makeCallbacks();
		createConnection('h', 8080, cb);
		await drainMicrotasks(); // probe fails
		// Server comes back
		vi.mocked(probeInstance).mockResolvedValue(mockInfo);
		await vi.advanceTimersByTimeAsync(1_000); // retry → probe ok → SSE opened (not probe-only)
		expect(connectSSE).toHaveBeenCalledOnce();
	});
});

// ── probe-only mode ───────────────────────────────────────────────────────────

describe('createConnection — useSSE: false', () => {
	test('does not open SSE', async () => {
		const cb = makeCallbacks();
		createConnection('h', 8080, cb, { useSSE: false });
		await flush();
		expect(connectSSE).not.toHaveBeenCalled();
		expect(cb.onStatus).toHaveBeenCalledWith('online');
	});

	test('schedules the next probe after 30s', async () => {
		vi.useFakeTimers();
		const cb = makeCallbacks();
		createConnection('h', 8080, cb, { useSSE: false });
		await drainMicrotasks(); // initial probe
		await vi.advanceTimersByTimeAsync(30_000); // next probe
		expect(probeInstance).toHaveBeenCalledTimes(2);
	});

	test('gives up after GIVE_UP_AFTER_MS of probe failures', async () => {
		vi.useFakeTimers();
		vi.mocked(probeInstance).mockRejectedValue(new Error('down'));
		const cb = makeCallbacks();
		createConnection('h', 8080, cb, { useSSE: false });
		await vi.advanceTimersByTimeAsync(GIVE_UP_AFTER_MS + 1_000);
		expect(cb.onGiveUp).toHaveBeenCalledOnce();
	});
});
