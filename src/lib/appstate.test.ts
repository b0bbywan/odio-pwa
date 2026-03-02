import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { SSEExtraCallbacks } from './sse';

// Mock dependencies before importing AppState
vi.mock('./sse', () => ({ connectSSE: vi.fn() }));
vi.mock('./api', () => ({ probeInstance: vi.fn() }));

import { AppState } from './state.svelte';
import { connectSSE } from './sse';
import { probeInstance } from './api';

// --- helpers ---

const mockServerInfo = {
	hostname: 'raspi',
	os_platform: 'linux',
	os_version: '6.1',
	api_sw: 'odio-api',
	api_version: '1.0.0',
	backends: { mpris: true, pulseaudio: true, systemd: true, zeroconf: false },
};

/**
 * Drain the microtask queue so async connectOne (probe → SSE) fully resolves.
 * setTimeout(resolve, 0) fires after all pending microtasks in Node.js.
 */
function flushPromises(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

type CapturedSSE = {
	host: string;
	port: number;
	onOpen: () => Promise<void>;
	onAlive: () => void;
	onOffline: () => void;
	extra?: SSEExtraCallbacks;
	cleanup: ReturnType<typeof vi.fn>;
};

let captured: CapturedSSE[] = [];

function setupConnectSSE() {
	vi.mocked(connectSSE).mockImplementation((host, port, onOpen, onAlive, onOffline, extra) => {
		const cleanup = vi.fn();
		captured.push({ host, port, onOpen, onAlive, onOffline, extra, cleanup });
		return cleanup;
	});
}

function lastSSE() {
	return captured[captured.length - 1];
}

beforeEach(() => {
	localStorage.clear();
	vi.clearAllMocks();
	captured = [];
	setupConnectSSE();
	vi.mocked(probeInstance).mockResolvedValue(mockServerInfo);
});

// ─── Instance management ────────────────────────────────────────────────────

describe('addInstance', () => {
	test('pushes a new instance with probing status', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080, 'my-pi');
		expect(s.instances).toHaveLength(1);
		// status='probing' is set synchronously at the start of createConnection
		expect(s.instances[0]).toMatchObject({ host: '192.168.1.1', port: 8080, label: 'my-pi', status: 'probing' });
	});

	test('persists to localStorage', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		const saved = JSON.parse(localStorage.getItem('odio-instances')!);
		expect(saved).toHaveLength(1);
		expect(saved[0]).toMatchObject({ host: '192.168.1.1', port: 8080 });
	});

	test('opens an SSE connection after probe succeeds', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises(); // probe resolves → connectSSE called
		expect(connectSSE).toHaveBeenCalledOnce();
		expect(lastSSE().host).toBe('192.168.1.1');
		expect(lastSSE().port).toBe(8080);
	});

	test('marks offline and does not open SSE when probe fails', async () => {
		vi.mocked(probeInstance).mockRejectedValue(new Error('unreachable'));
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises();
		expect(s.instances[0].status).toBe('offline');
		expect(connectSSE).not.toHaveBeenCalled();
	});
});

describe('removeInstance', () => {
	test('removes the instance from the array', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises();
		const id = s.instances[0].id;
		s.removeInstance(id);
		expect(s.instances).toHaveLength(0);
	});

	test('calls the SSE cleanup function', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises();
		const { cleanup } = lastSSE();
		s.removeInstance(s.instances[0].id);
		expect(cleanup).toHaveBeenCalledOnce();
	});

	test('navigates back to list when the active instance is removed', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises();
		const id = s.instances[0].id;
		s.openInstance(id);
		expect(s.currentView).toBe('instance');
		s.removeInstance(id);
		expect(s.currentView).toBe('list');
		expect(s.activeInstanceId).toBeNull();
	});

	test('does not affect view when a non-active instance is removed', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		s.addInstance('192.168.1.2', 8080);
		await flushPromises();
		s.openInstance(s.instances[0].id);
		s.removeInstance(s.instances[1].id);
		expect(s.currentView).toBe('instance');
	});
});

describe('updateInstance', () => {
	test('updates host/port/label and resets status to probing', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080, 'old');
		await flushPromises();
		const id = s.instances[0].id;
		s.updateInstance(id, '10.0.0.1', 9090, 'new');
		// probeOne → connectOne sets status='probing' synchronously
		expect(s.instances[0]).toMatchObject({ host: '10.0.0.1', port: 9090, label: 'new', status: 'probing' });
	});

	test('reconnects SSE with the new host/port', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises();
		const id = s.instances[0].id;
		const firstCleanup = lastSSE().cleanup;
		s.updateInstance(id, '10.0.0.1', 9090);
		await flushPromises();
		expect(firstCleanup).toHaveBeenCalledOnce(); // old connection closed
		expect(lastSSE().host).toBe('10.0.0.1');     // new connection opened
	});
});

// ─── Navigation ─────────────────────────────────────────────────────────────

describe('openInstance / goToList', () => {
	test('openInstance sets view and activeInstanceId', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		const id = s.instances[0].id;
		s.openInstance(id);
		expect(s.currentView).toBe('instance');
		expect(s.activeInstanceId).toBe(id);
	});

	test('goToList resets the view', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		s.openInstance(s.instances[0].id);
		s.goToList();
		expect(s.currentView).toBe('list');
	});

	test('activeInstance returns the correct instance', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080, 'pi');
		const id = s.instances[0].id;
		s.openInstance(id);
		expect(s.activeInstance?.label).toBe('pi');
	});

	test('activeInstance returns undefined when on the list view', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		expect(s.activeInstance).toBeUndefined();
	});
});

// ─── Connection lifecycle ────────────────────────────────────────────────────

describe('connectOne / disconnectOne', () => {
	test('connectOne marks instance as probing immediately (sync)', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		const id = s.instances[0].id;
		s.disconnectOne(id);
		s.connectOne(id);
		expect(s.instances[0].status).toBe('probing');
	});

	test('connectOne opens SSE after probe resolves', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		const id = s.instances[0].id;
		await flushPromises();
		s.disconnectOne(id);
		vi.clearAllMocks();
		captured = [];
		s.connectOne(id);
		await flushPromises();
		expect(connectSSE).toHaveBeenCalledOnce();
	});

	test('connectOne forwards onPowerAction to connectSSE', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		const id = s.instances[0].id;
		const onPowerAction = vi.fn();
		s.disconnectOne(id);
		captured = [];
		s.connectOne(id, { onPowerAction });
		await flushPromises();
		expect(lastSSE().extra?.onPowerAction).toBe(onPowerAction);
	});

	test('disconnectOne calls the cleanup and removes the entry', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises();
		const id = s.instances[0].id;
		const { cleanup } = lastSSE();
		s.disconnectOne(id);
		expect(cleanup).toHaveBeenCalledOnce();
		// disconnecting again is a no-op
		s.disconnectOne(id);
		expect(cleanup).toHaveBeenCalledOnce();
	});

	test('SSE disconnect triggers backoff retry (SSE closed, no immediate new connection)', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises();
		const { cleanup, onOffline } = lastSSE();
		onOffline();
		expect(cleanup).toHaveBeenCalledOnce(); // SSE torn down
		expect(s.instances[0].status).toBe('offline');
		// No immediate new SSE — retry is scheduled with backoff
		expect(connectSSE).toHaveBeenCalledOnce();
	});
});

describe('connectAll / disconnectAll', () => {
	test('connectAll opens SSE for every instance', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		s.addInstance('192.168.1.2', 8080);
		await flushPromises(); // drain initial connections
		vi.clearAllMocks();
		captured = [];
		s.connectAll();
		await flushPromises();
		expect(connectSSE).toHaveBeenCalledTimes(2);
	});

	test('disconnectAll calls every cleanup', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		s.addInstance('192.168.1.2', 8080);
		await flushPromises();
		const cleanups = captured.map((c) => c.cleanup);
		s.disconnectAll();
		cleanups.forEach((c) => expect(c).toHaveBeenCalledOnce());
	});

	test('connectAll then disconnectAll leaves no dangling connections', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises();
		const { cleanup } = lastSSE();
		s.disconnectAll();
		expect(cleanup).toHaveBeenCalledOnce();
		// second disconnectAll is safe
		expect(() => s.disconnectAll()).not.toThrow();
	});
});

describe('connectOne — edge cases', () => {
	test('is a no-op when id does not exist', () => {
		const s = new AppState();
		expect(() => s.connectOne('non-existent')).not.toThrow();
	});
});

describe('probeOne', () => {
	test('tears down existing connection and reconnects', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises();
		const id = s.instances[0].id;
		const firstCleanup = lastSSE().cleanup;
		captured = [];
		s.probeOne(id);
		await flushPromises();
		expect(firstCleanup).toHaveBeenCalledOnce(); // old connection torn down
		expect(captured).toHaveLength(1);            // new connection opened
	});

	test('can upgrade a previously-failing instance to SSE when server comes back', async () => {
		vi.mocked(probeInstance).mockRejectedValue(new Error('unreachable'));
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises();
		expect(connectSSE).not.toHaveBeenCalled(); // probe failed, no SSE

		vi.mocked(probeInstance).mockResolvedValue(mockServerInfo);
		s.probeOne(s.instances[0].id);
		await flushPromises();
		expect(connectSSE).toHaveBeenCalledOnce(); // now reachable → SSE opened
	});
});

// ─── SSE callback effects ────────────────────────────────────────────────────

describe('onOpen callback', () => {
	test('refreshes serverInfo and sets status to online', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises();
		await lastSSE().onOpen();
		expect(s.instances[0].status).toBe('online');
		expect(s.instances[0].serverInfo).toEqual(mockServerInfo);
	});

	test('stays online when re-probe fails on SSE reconnect (SSE is open)', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises();
		vi.mocked(probeInstance).mockRejectedValue(new Error('unreachable'));
		await lastSSE().onOpen();
		// SSE is connected → server is reachable even if /server probe failed transiently
		expect(s.instances[0].status).toBe('online');
	});

	test('persists serverInfo to localStorage', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises();
		await lastSSE().onOpen();
		const saved = JSON.parse(localStorage.getItem('odio-instances')!);
		expect(saved[0].serverInfo).toEqual(mockServerInfo);
	});
});

describe('onAlive callback', () => {
	test('sets status to online', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises();
		s.instances[0].status = 'offline';
		lastSSE().onAlive();
		expect(s.instances[0].status).toBe('online');
	});
});

describe('onOffline callback', () => {
	test('sets status to offline', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises();
		s.instances[0].status = 'online';
		lastSSE().onOffline();
		expect(s.instances[0].status).toBe('offline');
	});
});

// ─── onlineInstances ─────────────────────────────────────────────────────────

describe('onlineInstances', () => {
	test('returns only instances whose status is online', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		s.addInstance('192.168.1.2', 8080);
		s.instances[0].status = 'online';
		s.instances[1].status = 'offline';
		expect(s.onlineInstances).toHaveLength(1);
		expect(s.onlineInstances[0].host).toBe('192.168.1.1');
	});

	test('returns empty array when no instance is online', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		s.instances[0].status = 'offline';
		expect(s.onlineInstances).toHaveLength(0);
	});
});

// ─── SSE_LIMIT / startPolling ─────────────────────────────────────────────────

describe('addInstance — SSE_LIMIT', () => {
	test('7th instance uses polling instead of SSE', async () => {
		const s = new AppState();
		for (let i = 1; i <= 7; i++) {
			s.addInstance(`192.168.1.${i}`, 8080);
		}
		await flushPromises();
		// First 6 get SSE connections; 7th falls back to probe-only
		expect(connectSSE).toHaveBeenCalledTimes(6);
		expect(probeInstance).toHaveBeenCalledTimes(7);
	});

	test('disconnectAll tears down poll connections too', async () => {
		const s = new AppState();
		for (let i = 1; i <= 7; i++) {
			s.addInstance(`192.168.1.${i}`, 8080);
		}
		await flushPromises();
		const sseCleanups = captured.map((c) => c.cleanup);
		s.disconnectAll();
		sseCleanups.forEach((c) => expect(c).toHaveBeenCalledOnce());
	});
});

// ─── probeAll ─────────────────────────────────────────────────────────────────

describe('probeAll', () => {
	test('reconnects every instance', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		s.addInstance('192.168.1.2', 8080);
		await flushPromises();
		const initialCleanups = captured.map((c) => c.cleanup);
		vi.clearAllMocks();
		captured = [];
		s.probeAll();
		await flushPromises();
		initialCleanups.forEach((c) => expect(c).toHaveBeenCalledOnce());
		expect(connectSSE).toHaveBeenCalledTimes(2);
	});
});

// ─── localStorage persistence across sessions ────────────────────────────────

describe('persistence', () => {
	test('instances survive a reload (new AppState reads localStorage)', async () => {
		const s1 = new AppState();
		s1.addInstance('192.168.1.1', 8080, 'pi');
		await flushPromises(); // probe succeeds → serverInfo persisted
		const s2 = new AppState();
		expect(s2.instances).toHaveLength(1);
		expect(s2.instances[0]).toMatchObject({ host: '192.168.1.1', label: 'pi' });
		expect(s2.instances[0].serverInfo).toEqual(mockServerInfo);
	});

	test('status is reset to unknown on reload', async () => {
		const s1 = new AppState();
		s1.addInstance('192.168.1.1', 8080);
		await flushPromises(); // probe succeeds → status 'online'
		expect(s1.instances[0].status).toBe('online');
		const s2 = new AppState();
		expect(s2.instances[0].status).toBe('unknown');
	});
});
