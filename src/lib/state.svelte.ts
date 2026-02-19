import type { OdioInstance, AppView } from './types';
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

	get activeInstance(): OdioInstance | undefined {
		return this.instances.find((i) => i.id === this.activeInstanceId);
	}

	get onlineInstances(): OdioInstance[] {
		return this.instances.filter((i) => i.status === 'online');
	}

	addInstance(host: string, port: number, label?: string): void {
		const id = crypto.randomUUID();
		this.instances.push({
			id,
			host,
			port,
			label,
			status: 'unknown',
			serverInfo: null,
		});
		saveInstances(this.instances);
		this.probeOne(id);
	}

	removeInstance(id: string): void {
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

	async probeOne(id: string): Promise<void> {
		const inst = this.instances.find((i) => i.id === id);
		if (!inst) return;
		inst.status = 'probing';
		try {
			const info = await probeInstance(inst.host, inst.port);
			inst.serverInfo = info;
			inst.status = 'online';
		} catch {
			inst.status = 'offline';
		}
		saveInstances(this.instances);
	}

	async probeAll(): Promise<void> {
		await Promise.allSettled(this.instances.map((i) => this.probeOne(i.id)));
	}
}

export const appState = new AppState();
