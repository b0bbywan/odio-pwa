import type { OdioInstance } from './types';
import { createConnection } from './connection';
import { push } from 'svelte-spa-router';

const STORAGE_KEY = 'odio-instances';
const SSE_LIMIT = 6;
const DEFAULT_PORT = 8018;

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
	const toSave = instances
		.filter((i) => !i.transient)
		.map(({ id, host, port, label, serverInfo, connectedAt }) => ({
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

export function instancePath(host: string, port: number, label?: string): string {
	const base = port === DEFAULT_PORT
		? `/i/${encodeURIComponent(host)}`
		: `/i/${encodeURIComponent(host)}/${port}`;
	if (!label) return base;
	return `${base}?label=${encodeURIComponent(label)}`;
}

export interface InstanceCallbacks {
	onPowerAction?: (action: 'reboot' | 'poweroff') => void;
	onGiveUp?: () => void;
}

export class AppState {
	instances: OdioInstance[] = $state(loadInstances());
	savePromptVisible: boolean = $state(false);

	// SSE connections (max SSE_LIMIT); polling connections for the rest
	private sseConnections = new Map<string, () => void>();
	private pollConnections = new Map<string, () => void>();
	// Power callbacks set by InstanceView while it's the foreground view.
	// Looked up dynamically inside the connection wrappers, so a second
	// connectOne (e.g. background pool then foreground attach) just swaps
	// the callbacks instead of tearing down and re-firing the probe.
	private foregroundCallbacks = new Map<string, InstanceCallbacks>();

	// Instances the user can actually switch to: SSE up, or up-but-no-CORS-headers
	// (the iframe still loads in that case).
	get connectableInstances(): OdioInstance[] {
		return this.instances.filter((i) => i.status === 'online' || i.status === 'cors');
	}

	get sortedInstances(): OdioInstance[] {
		return [...this.instances].sort(byPriority);
	}

	addInstance(host: string, port: number, label?: string, opts: { transient?: boolean } = {}): string {
		const id = crypto.randomUUID();
		this.instances.push({ id, host, port, label, status: 'unknown', serverInfo: null, transient: opts.transient });
		if (!opts.transient) saveInstances(this.instances);
		if (this.sseConnections.size < SSE_LIMIT) {
			this.connectOne(id);
		} else {
			this.startPolling(id);
		}
		return id;
	}

	findByHostPort(host: string, port: number): OdioInstance | undefined {
		return this.instances.find((i) => i.host === host && i.port === port);
	}

	findById(id: string): OdioInstance | undefined {
		return this.instances.find((i) => i.id === id);
	}

	persistInstance(id: string): void {
		const inst = this.instances.find((i) => i.id === id);
		if (inst && inst.transient) {
			inst.transient = false;
			saveInstances(this.instances);
		}
	}

	removeInstance(id: string): void {
		this.disconnectOne(id);
		this.stopPolling(id);
		const idx = this.instances.findIndex((i) => i.id === id);
		if (idx !== -1) {
			this.instances.splice(idx, 1);
			saveInstances(this.instances);
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
		const inst = this.findById(id);
		if (inst) push(instancePath(inst.host, inst.port, inst.label));
	}

	goToList(): void {
		push('/');
	}

	// Idempotent for the connection itself: if there's already an SSE up for
	// this id, only the foreground callbacks are swapped. Pass extras to
	// register power callbacks (foreground); call without extras to drop
	// them (hand back to background pool). Use disconnectOne / probeOne
	// when you actually need to tear down and re-fire the probe.
	connectOne(id: string, extra?: InstanceCallbacks): void {
		const inst = this.instances.find((i) => i.id === id);
		if (!inst) return;
		if (extra) this.foregroundCallbacks.set(id, extra);
		else this.foregroundCallbacks.delete(id);
		if (this.sseConnections.has(id)) return;
		const destroy = createConnection(inst.host, inst.port, {
			onStatus: (status) => {
				inst.status = status;
			},
			onServerInfo: (info) => {
				inst.serverInfo = info;
				inst.connectedAt = Date.now();
				saveInstances(this.instances);
			},
			onGiveUp: () => this.foregroundCallbacks.get(id)?.onGiveUp?.(),
			onPowerAction: (action) => this.foregroundCallbacks.get(id)?.onPowerAction?.(action),
		});
		this.sseConnections.set(id, destroy);
	}

	disconnectOne(id: string): void {
		this.sseConnections.get(id)?.();
		this.sseConnections.delete(id);
		this.foregroundCallbacks.delete(id);
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

	// Idempotent: leaves existing connections alone (InstanceView may have
	// already attached one with power callbacks for the current instance).
	connectAll(): void {
		const sorted = this.sortedInstances;
		sorted.slice(0, SSE_LIMIT).forEach((i) => {
			if (!this.sseConnections.has(i.id)) this.connectOne(i.id);
		});
		sorted.slice(SSE_LIMIT).forEach((i) => {
			if (!this.sseConnections.has(i.id) && !this.pollConnections.has(i.id)) {
				this.startPolling(i.id);
			}
		});
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
