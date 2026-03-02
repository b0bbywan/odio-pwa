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
	test('pushes a new instance with unknown status', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080, 'my-pi');
		expect(s.instances).toHaveLength(1);
		expect(s.instances[0]).toMatchObject({ host: '192.168.1.1', port: 8080, label: 'my-pi', status: 'probing' });
	});

	test('persists to localStorage', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		const saved = JSON.parse(localStorage.getItem('odio-instances')!);
		expect(saved).toHaveLength(1);
		expect(saved[0]).toMatchObject({ host: '192.168.1.1', port: 8080 });
	});

	test('opens an SSE connection', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		expect(connectSSE).toHaveBeenCalledOnce();
		expect(lastSSE().host).toBe('192.168.1.1');
		expect(lastSSE().port).toBe(8080);
	});
});

describe('removeInstance', () => {
	test('removes the instance from the array', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		const id = s.instances[0].id;
		s.removeInstance(id);
		expect(s.instances).toHaveLength(0);
	});

	test('calls the SSE cleanup function', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		const { cleanup } = lastSSE();
		s.removeInstance(s.instances[0].id);
		expect(cleanup).toHaveBeenCalledOnce();
	});

	test('navigates back to list when the active instance is removed', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		const id = s.instances[0].id;
		s.openInstance(id);
		expect(s.currentView).toBe('instance');
		s.removeInstance(id);
		expect(s.currentView).toBe('list');
		expect(s.activeInstanceId).toBeNull();
	});

	test('does not affect view when a non-active instance is removed', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		s.addInstance('192.168.1.2', 8080);
		s.openInstance(s.instances[0].id);
		s.removeInstance(s.instances[1].id);
		expect(s.currentView).toBe('instance');
	});
});

describe('updateInstance', () => {
	test('updates host/port/label and resets status', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080, 'old');
		const id = s.instances[0].id;
		s.updateInstance(id, '10.0.0.1', 9090, 'new');
		expect(s.instances[0]).toMatchObject({ host: '10.0.0.1', port: 9090, label: 'new', status: 'probing' });
	});

	test('reconnects SSE with the new host/port', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		const id = s.instances[0].id;
		const firstCleanup = lastSSE().cleanup;
		s.updateInstance(id, '10.0.0.1', 9090);
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

// ─── SSE lifecycle ───────────────────────────────────────────────────────────

describe('connectOne / disconnectOne', () => {
	test('connectOne marks instance as probing and opens SSE', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		const id = s.instances[0].id;
		s.disconnectOne(id);
		vi.clearAllMocks();
		captured = [];
		s.connectOne(id);
		expect(s.instances[0].status).toBe('probing');
		expect(connectSSE).toHaveBeenCalledOnce();
	});

	test('connectOne passes extra callbacks through to connectSSE', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		const id = s.instances[0].id;
		const onPowerAction = vi.fn();
		const onBye = vi.fn();
		s.disconnectOne(id);
		captured = [];
		s.connectOne(id, { onPowerAction, onBye });
		expect(lastSSE().extra?.onPowerAction).toBe(onPowerAction);
		expect(lastSSE().extra?.onBye).toBe(onBye);
	});

	test('disconnectOne calls the cleanup and removes the entry', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		const id = s.instances[0].id;
		const { cleanup } = lastSSE();
		s.disconnectOne(id);
		expect(cleanup).toHaveBeenCalledOnce();
		// disconnecting again is a no-op
		s.disconnectOne(id);
		expect(cleanup).toHaveBeenCalledOnce();
	});
});

describe('connectAll / disconnectAll', () => {
	test('connectAll opens SSE for every instance', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		s.addInstance('192.168.1.2', 8080);
		vi.clearAllMocks();
		captured = [];
		s.connectAll();
		expect(connectSSE).toHaveBeenCalledTimes(2);
	});

	test('disconnectAll calls every cleanup', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		s.addInstance('192.168.1.2', 8080);
		const cleanups = captured.map((c) => c.cleanup);
		s.disconnectAll();
		cleanups.forEach((c) => expect(c).toHaveBeenCalledOnce());
	});

	test('connectAll then disconnectAll leaves no dangling connections', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		const { cleanup } = lastSSE();
		s.disconnectAll();
		expect(cleanup).toHaveBeenCalledOnce();
		// second disconnectAll is safe
		expect(() => s.disconnectAll()).not.toThrow();
	});
});

describe('probeOne', () => {
	test('reconnects SSE for an SSE-managed instance', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		const id = s.instances[0].id;
		const firstCleanup = lastSSE().cleanup;
		captured = [];
		s.probeOne(id);
		expect(firstCleanup).toHaveBeenCalledOnce(); // old connection torn down
		expect(captured).toHaveLength(1);            // new connection opened
	});
});

// ─── SSE callback effects ────────────────────────────────────────────────────

describe('onOpen callback', () => {
	test('successful probe sets status to online with serverInfo', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await lastSSE().onOpen();
		expect(s.instances[0].status).toBe('online');
		expect(s.instances[0].serverInfo).toEqual(mockServerInfo);
	});

	test('failed probe sets status to offline', async () => {
		vi.mocked(probeInstance).mockRejectedValue(new Error('unreachable'));
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await lastSSE().onOpen();
		expect(s.instances[0].status).toBe('offline');
	});

	test('successful probe persists serverInfo to localStorage', async () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		await lastSSE().onOpen();
		const saved = JSON.parse(localStorage.getItem('odio-instances')!);
		expect(saved[0].serverInfo).toEqual(mockServerInfo);
	});
});

describe('onAlive callback', () => {
	test('sets status to online', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		s.instances[0].status = 'offline';
		lastSSE().onAlive();
		expect(s.instances[0].status).toBe('online');
	});
});

describe('onOffline callback', () => {
	test('sets status to offline', () => {
		const s = new AppState();
		s.addInstance('192.168.1.1', 8080);
		s.instances[0].status = 'online';
		lastSSE().onOffline();
		expect(s.instances[0].status).toBe('offline');
	});
});

// ─── localStorage persistence across sessions ────────────────────────────────

describe('persistence', () => {
	test('instances survive a reload (new AppState reads localStorage)', async () => {
		const s1 = new AppState();
		s1.addInstance('192.168.1.1', 8080, 'pi');
		await lastSSE().onOpen(); // populate serverInfo
		const s2 = new AppState();
		expect(s2.instances).toHaveLength(1);
		expect(s2.instances[0]).toMatchObject({ host: '192.168.1.1', label: 'pi' });
		expect(s2.instances[0].serverInfo).toEqual(mockServerInfo);
	});

	test('status is reset to unknown on reload', async () => {
		const s1 = new AppState();
		s1.addInstance('192.168.1.1', 8080);
		await lastSSE().onOpen();
		expect(s1.instances[0].status).toBe('online');
		const s2 = new AppState();
		expect(s2.instances[0].status).toBe('unknown');
	});
});
