import type { OdioInstance, AppView } from './types';
import { createConnection } from './connection';

const STORAGE_KEY = 'odio-instances';
const SSE_LIMIT = 6;

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
export function byPriority(a: OdioInstance, b: OdioInstance): number {
	const aPower = a.serverInfo?.backends.power ? 1 : 0;
	const bPower = b.serverInfo?.backends.power ? 1 : 0;
	if (bPower !== aPower) return bPower - aPower;
	return (b.connectedAt ?? 0) - (a.connectedAt ?? 0);
}

export interface InstanceCallbacks {
	onPowerAction?: (action: 'reboot' | 'poweroff') => void;
	onGiveUp?: () => void;
}

export class AppState {
	instances: OdioInstance[] = $state(loadInstances());
	currentView: AppView = $state('list');
	activeInstanceId: string | null = $state(null);

	// SSE connections (max SSE_LIMIT); polling connections for the rest
	private sseConnections = new Map<string, () => void>();
	private pollConnections = new Map<string, () => void>();

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
		if (this.sseConnections.size < SSE_LIMIT) {
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

	connectOne(id: string, extra?: InstanceCallbacks): void {
		const inst = this.instances.find((i) => i.id === id);
		if (!inst) return;
		this.disconnectOne(id);
		const destroy = createConnection(inst.host, inst.port, {
			onStatus: (status) => {
				inst.status = status;
			},
			onServerInfo: (info) => {
				inst.serverInfo = info;
				inst.connectedAt = Date.now();
				saveInstances(this.instances);
			},
			onGiveUp: extra?.onGiveUp ?? (() => {}),
			onPowerAction: extra?.onPowerAction,
		});
		this.sseConnections.set(id, destroy);
	}

	disconnectOne(id: string): void {
		this.sseConnections.get(id)?.();
		this.sseConnections.delete(id);
	}

	private startPolling(id: string): void {
		const inst = this.instances.find((i) => i.id === id);
		if (!inst) return;
		this.stopPolling(id);
		const destroy = createConnection(inst.host, inst.port, {
			onStatus: (status) => {
				inst.status = status;
			},
			onServerInfo: (info) => {
				inst.serverInfo = info;
				inst.connectedAt = Date.now();
				saveInstances(this.instances);
			},
			onGiveUp: () => {}, // background instances have no power UI
		}, { useSSE: false });
		this.pollConnections.set(id, destroy);
	}

	private stopPolling(id: string): void {
		this.pollConnections.get(id)?.();
		this.pollConnections.delete(id);
	}

	connectAll(): void {
		const sorted = this.sortedInstances;
		sorted.slice(0, SSE_LIMIT).forEach((i) => this.connectOne(i.id));
		sorted.slice(SSE_LIMIT).forEach((i) => this.startPolling(i.id));
	}

	disconnectAll(): void {
		this.sseConnections.forEach((destroy) => destroy());
		this.sseConnections.clear();
		this.pollConnections.forEach((destroy) => destroy());
		this.pollConnections.clear();
	}

	// Always does a fresh probe + SSE attempt
	probeOne(id: string): void {
		this.stopPolling(id);
		this.disconnectOne(id);
		this.connectOne(id);
	}

	probeAll(): void {
		this.instances.forEach((i) => this.probeOne(i.id));
	}
}

export const appState = new AppState();
