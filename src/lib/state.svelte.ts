import type { OdioInstance, AppView } from './types';
import { connectSSE } from './sse';
import { probeInstance } from './api';

const STORAGE_KEY = 'odio-instances';

function loadInstances(): OdioInstance[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as OdioInstance[];
		return parsed.map((i) => ({
			...i,
			status: 'unknown' as const,
			serverInfo: i.serverInfo ?? null,
		}));
	} catch {
		return [];
	}
}

function saveInstances(instances: OdioInstance[]): void {
	const toSave = instances.map(({ id, host, port, label, serverInfo }) => ({
		id,
		host,
		port,
		label,
		serverInfo,
	}));
	localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

class AppState {
	instances: OdioInstance[] = $state(loadInstances());
	currentView: AppView = $state('list');
	activeInstanceId: string | null = $state(null);

	private sseCleanup = new Map<string, () => void>();

	get activeInstance(): OdioInstance | undefined {
		return this.instances.find((i) => i.id === this.activeInstanceId);
	}

	get onlineInstances(): OdioInstance[] {
		return this.instances.filter((i) => i.status === 'online');
	}

	addInstance(host: string, port: number, label?: string): void {
		const id = crypto.randomUUID();
		this.instances.push({ id, host, port, label, status: 'unknown', serverInfo: null });
		saveInstances(this.instances);
		this.connectOne(id);
	}

	removeInstance(id: string): void {
		this.disconnectOne(id);
		const idx = this.instances.findIndex((i) => i.id === id);
		if (idx !== -1) {
			this.instances.splice(idx, 1);
			saveInstances(this.instances);
			if (this.activeInstanceId === id) {
				this.activeInstanceId = null;
				this.currentView = 'list';
			}
		}
	}

	updateInstance(id: string, host: string, port: number, label?: string): void {
		const inst = this.instances.find((i) => i.id === id);
		if (inst) {
			inst.host = host;
			inst.port = port;
			inst.label = label;
			inst.status = 'unknown';
			saveInstances(this.instances);
			// reconnect to the new host/port
			this.probeOne(id);
		}
	}

	openInstance(id: string): void {
		this.activeInstanceId = id;
		this.currentView = 'instance';
	}

	goToList(): void {
		this.currentView = 'list';
	}

	connectOne(id: string): void {
		const inst = this.instances.find((i) => i.id === id);
		if (!inst) return;
		inst.status = 'probing';
		const cleanup = connectSSE(
			inst.host,
			inst.port,
			async () => {
				// SSE connected — fetch server info via GET /server
				try {
					inst.serverInfo = await probeInstance(inst.host, inst.port);
					inst.status = 'online';
				} catch {
					inst.status = 'offline';
				}
				saveInstances(this.instances);
			},
			(info) => {
				// server.info SSE event — keep serverInfo in sync
				inst.serverInfo = info;
				inst.status = 'online';
				saveInstances(this.instances);
			},
			() => {
				inst.status = 'offline';
				saveInstances(this.instances);
			},
		);
		this.sseCleanup.set(id, cleanup);
	}

	disconnectOne(id: string): void {
		this.sseCleanup.get(id)?.();
		this.sseCleanup.delete(id);
	}

	connectAll(): void {
		this.instances.forEach((i) => this.connectOne(i.id));
	}

	disconnectAll(): void {
		this.sseCleanup.forEach((cleanup) => cleanup());
		this.sseCleanup.clear();
	}

	// Reconnects SSE — used by the per-card and global refresh buttons
	probeOne(id: string): void {
		this.disconnectOne(id);
		this.connectOne(id);
	}

	probeAll(): void {
		this.instances.forEach((i) => this.probeOne(i.id));
	}
}

export const appState = new AppState();
