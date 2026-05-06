import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { SSEExtraCallbacks } from './sse';

// Mock dependencies before importing AppState
vi.mock('./sse', () => ({ connectSSE: vi.fn() }));
vi.mock('./api', () => ({ probeInstance: vi.fn() }));
vi.mock('svelte-spa-router', () => ({ push: vi.fn() }));

import { AppState, instancePath } from './state.svelte';
import { connectSSE } from './sse';
import { probeInstance } from './api';
import { push } from 'svelte-spa-router';

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
	onOpen: () => void;
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

describe('addInstance — transient', () => {
	test('adds an instance flagged as transient', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080, 'pi', { transient: true });
		expect(s.instances[0]).toMatchObject({ host: '192.168.1.1', transient: true });
	});

	test('does not persist transient instances to localStorage', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080, undefined, { transient: true });
		expect(localStorage.getItem('odio-instances')).toBeNull();
	});

	test('still opens an SSE connection for transient instances', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080, undefined, { transient: true });
		await flushPromises();
		expect(connectSSE).toHaveBeenCalledOnce();
	});

	test('returns the new instance id', () => {
		const s = new AppState();
		const id = s.addInstance('192.168.1.1', 8080);
		expect(id).toBe(s.instances[0].id);
	});

	test('saving an existing connectedAt does not leak the transient one to storage', async () => {
		// onServerInfo persists to storage; the transient flag must filter it out.
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080, undefined, { transient: true });
		await flushPromises();
		await lastSSE().onOpen(); // triggers saveInstances via onServerInfo
		expect(localStorage.getItem('odio-instances')).toBe('[]');
	});
});

describe('persistInstance', () => {
	test('clears the transient flag and writes to localStorage', () => {
		const s = new AppState();
		const id = s.addInstance('192.168.1.1', 8080, 'pi', { transient: true });
		s.persistInstance(id);
		expect(s.instances[0].transient).toBe(false);
		const saved = JSON.parse(localStorage.getItem('odio-instances')!);
		expect(saved).toHaveLength(1);
		expect(saved[0]).toMatchObject({ host: '192.168.1.1', label: 'pi' });
	});

	test('is a no-op for non-transient instances', () => {
		const s = new AppState();
		const id = s.addInstance('192.168.1.1', 8080);
		localStorage.clear();
		s.persistInstance(id);
		expect(localStorage.getItem('odio-instances')).toBeNull();
	});

	test('is a no-op for unknown ids', () => {
		const s = new AppState();
		expect(() => s.persistInstance('does-not-exist')).not.toThrow();
	});
});

describe('findByHostPort', () => {
	test('returns the matching instance', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		s.addInstance('192.168.1.2', 9090);
		expect(s.findByHostPort('192.168.1.2', 9090)?.host).toBe('192.168.1.2');
	});

	test('returns undefined when host:port does not match', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		expect(s.findByHostPort('10.0.0.1', 8080)).toBeUndefined();
		expect(s.findByHostPort('192.168.1.1', 9090)).toBeUndefined();
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

	test('removes from the instances list and from localStorage', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises();
		const id = s.instances[0].id;
		s.removeInstance(id);
		expect(s.instances).toHaveLength(0);
		expect(JSON.parse(localStorage.getItem('odio-instances') || '[]')).toEqual([]);
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

describe('openInstance / goToList / instancePath', () => {
	test('openInstance routes to /i/<host> for default port 8018', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8018);
		s.openInstance(s.instances[0].id);
		expect(push).toHaveBeenCalledWith('/i/192.168.1.1');
	});

	test('openInstance includes the port when not default', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 9000);
		s.openInstance(s.instances[0].id);
		expect(push).toHaveBeenCalledWith('/i/192.168.1.1/9000');
	});

	test('openInstance encodes host and label safely', () => {
		const s = new AppState();
		s.addInstance('my server', 9000, 'Living Room');
		s.openInstance(s.instances[0].id);
		expect(push).toHaveBeenCalledWith('/i/my%20server/9000?label=Living%20Room');
	});

	test('openInstance is a no-op when the id is unknown', () => {
		const s = new AppState();
		s.openInstance('no-such-id');
		expect(push).not.toHaveBeenCalled();
	});

	test('goToList routes to /', () => {
		const s = new AppState();
		s.goToList();
		expect(push).toHaveBeenCalledWith('/');
	});

	test('instancePath builder matches the openInstance routing', () => {
		expect(instancePath('192.168.1.1', 8018)).toBe('/i/192.168.1.1');
		expect(instancePath('192.168.1.1', 9000)).toBe('/i/192.168.1.1/9000');
		expect(instancePath('my server', 9000, 'Living Room')).toBe(
			'/i/my%20server/9000?label=Living%20Room',
		);
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

	test('connectOne wires onPowerAction so connectSSE forwards events to it', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		const id = s.instances[0].id;
		const onPowerAction = vi.fn();
		s.disconnectOne(id);
		captured = [];
		s.connectOne(id, { onPowerAction });
		await flushPromises();
		lastSSE().extra?.onPowerAction?.('reboot');
		expect(onPowerAction).toHaveBeenCalledWith('reboot');
	});

	test('connectOne is idempotent for the connection - second call only swaps callbacks', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises(); // initial connection from addInstance
		vi.clearAllMocks();
		captured = [];
		const onPowerAction = vi.fn();
		s.connectOne(s.instances[0].id, { onPowerAction });
		await flushPromises();
		// No new SSE: the existing connection's callbacks were updated in place.
		expect(connectSSE).not.toHaveBeenCalled();
	});

	test('connectOne lets a re-attached onPowerAction fire on subsequent power events', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises();
		const id = s.instances[0].id;
		const sse = lastSSE();
		// Foreground attaches with callbacks, then drops them.
		const onPowerAction = vi.fn();
		s.connectOne(id, { onPowerAction });
		s.connectOne(id); // hand back to background pool
		sse.extra?.onPowerAction?.('reboot');
		expect(onPowerAction).not.toHaveBeenCalled();
		// Re-attach with new callbacks - same connection, new wrapper target.
		const onPowerAction2 = vi.fn();
		s.connectOne(id, { onPowerAction: onPowerAction2 });
		sse.extra?.onPowerAction?.('poweroff');
		expect(onPowerAction2).toHaveBeenCalledWith('poweroff');
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
		const { cleanup, onOpen, onOffline } = lastSSE();
		await onOpen(); // SSE was open before dropping
		onOffline();
		expect(cleanup).toHaveBeenCalledOnce(); // SSE torn down
		expect(s.instances[0].status).toBe('offline');
		// No immediate new SSE — retry is scheduled with backoff
		expect(connectSSE).toHaveBeenCalledOnce();
	});
});

describe('connectAll / disconnectAll', () => {
	test('connectAll opens SSE for every instance that is not already connected', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		s.addInstance('192.168.1.2', 8080);
		await flushPromises(); // drain initial connections
		s.disconnectAll();
		vi.clearAllMocks();
		captured = [];
		s.connectAll();
		await flushPromises();
		expect(connectSSE).toHaveBeenCalledTimes(2);
	});

	test('connectAll is idempotent — leaves existing SSE connections in place', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		s.addInstance('192.168.1.2', 8080);
		await flushPromises(); // drain initial connections (2 SSE)
		vi.clearAllMocks();
		captured = [];
		s.connectAll(); // should be a no-op since both are already connected
		await flushPromises();
		expect(connectSSE).not.toHaveBeenCalled();
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
	test('sets status to offline when SSE was open', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await flushPromises();
		await lastSSE().onOpen(); // SSE was open before dropping
		lastSSE().onOffline();
		expect(s.instances[0].status).toBe('offline');
	});
});

// ─── connectableInstances ────────────────────────────────────────────────────

describe('connectableInstances', () => {
	test('includes online instances', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		s.addInstance('192.168.1.2', 8080);
		s.instances[0].status = 'online';
		s.instances[1].status = 'offline';
		expect(s.connectableInstances).toHaveLength(1);
		expect(s.connectableInstances[0].host).toBe('192.168.1.1');
	});

	test('includes cors instances - the iframe still loads without API CORS headers', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		s.addInstance('192.168.1.2', 8080);
		s.instances[0].status = 'online';
		s.instances[1].status = 'cors';
		expect(s.connectableInstances).toHaveLength(2);
	});

	test('excludes offline, blocked, probing, unknown', () => {
		const s = new AppState();
		s.addInstance('a', 1);
		s.addInstance('b', 1);
		s.addInstance('c', 1);
		s.addInstance('d', 1);
		s.instances[0].status = 'offline';
		s.instances[1].status = 'blocked';
		s.instances[2].status = 'probing';
		s.instances[3].status = 'unknown';
		expect(s.connectableInstances).toHaveLength(0);
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
