import type { OdioInstance, AppView } from './types';
import { connectSSE } from './sse';
import { probeInstance } from './api';

const STORAGE_KEY = 'odio-instances';
const SSE_LIMIT = 6;
const POLL_INTERVAL_MS = 30_000;

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
	const toSave = instances.map(({ id, host, port, label, serverInfo, connectedAt }) => ({
		id,
		host,
		port,
		label,
		serverInfo,
		connectedAt,
	}));
	localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

// Sort: power-backend instances first, then by most recently connected
function byPriority(a: OdioInstance, b: OdioInstance): number {
	const aPower = a.serverInfo?.backends.power ? 1 : 0;
	const bPower = b.serverInfo?.backends.power ? 1 : 0;
	if (bPower !== aPower) return bPower - aPower;
	return (b.connectedAt ?? 0) - (a.connectedAt ?? 0);
}

class AppState {
	instances: OdioInstance[] = $state(loadInstances());
	currentView: AppView = $state('list');
	activeInstanceId: string | null = $state(null);

	private sseCleanup = new Map<string, () => void>();
	private pollingTimers = new Map<string, ReturnType<typeof setInterval>>();

	get activeInstance(): OdioInstance | undefined {
		return this.instances.find((i) => i.id === this.activeInstanceId);
	}

	get onlineInstances(): OdioInstance[] {
		return this.instances.filter((i) => i.status === 'online');
	}

	get sortedInstances(): OdioInstance[] {
		return [...this.instances].sort(byPriority);
	}

	addInstance(host: string, port: number, label?: string): void {
		const id = crypto.randomUUID();
		this.instances.push({ id, host, port, label, status: 'unknown', serverInfo: null });
		saveInstances(this.instances);
		// give SSE to the new instance if under the limit, otherwise poll
		if (this.sseCleanup.size < SSE_LIMIT) {
			this.connectOne(id);
		} else {
			this.startPolling(id);
		}
	}

	removeInstance(id: string): void {
		this.disconnectOne(id);
		this.stopPolling(id);
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
				try {
					inst.serverInfo = await probeInstance(inst.host, inst.port);
					inst.connectedAt = Date.now();
					inst.status = 'online';
				} catch {
					inst.status = 'offline';
				}
				saveInstances(this.instances);
			},
			(info) => {
				inst.serverInfo = info;
				inst.connectedAt = Date.now();
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

	private async pollOne(id: string): Promise<void> {
		const inst = this.instances.find((i) => i.id === id);
		if (!inst) return;
		inst.status = 'probing';
		try {
			inst.serverInfo = await probeInstance(inst.host, inst.port);
			inst.connectedAt = Date.now();
			inst.status = 'online';
		} catch {
			inst.status = 'offline';
		}
		saveInstances(this.instances);
	}

	private startPolling(id: string): void {
		this.pollOne(id);
		this.pollingTimers.set(id, setInterval(() => this.pollOne(id), POLL_INTERVAL_MS));
	}

	private stopPolling(id: string): void {
		clearInterval(this.pollingTimers.get(id));
		this.pollingTimers.delete(id);
	}

	connectAll(): void {
		const sorted = this.sortedInstances;
		sorted.slice(0, SSE_LIMIT).forEach((i) => this.connectOne(i.id));
		sorted.slice(SSE_LIMIT).forEach((i) => this.startPolling(i.id));
	}

	disconnectAll(): void {
		this.sseCleanup.forEach((cleanup) => cleanup());
		this.sseCleanup.clear();
		this.pollingTimers.forEach((timer) => clearInterval(timer));
		this.pollingTimers.clear();
	}

	// Reconnects SSE or re-polls — used by refresh buttons
	probeOne(id: string): void {
		if (this.sseCleanup.has(id)) {
			this.disconnectOne(id);
			this.connectOne(id);
		} else {
			this.pollOne(id);
		}
	}

	probeAll(): void {
		this.instances.forEach((i) => this.probeOne(i.id));
	}
}

export const appState = new AppState();
