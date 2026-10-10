import type { OdioInstance } from './types';
import { displayName, isConnectable } from './instance';
import {
	candidateNetworks,
	findActiveNetworks,
	networksOf,
	parseScanTarget,
	scanHosts,
	sweepNetworks,
	type ScanResult,
} from './scan';

function hostsOf(network: string): string[] {
	const parsed = parseScanTarget(network);
	return 'hosts' in parsed ? parsed.hosts : [];
}

/**
 * One network scan, from the form to its results. With no target it scans the
 * /24 of the instances online; with none online it looks for a connected
 * network among the common ones, then across 192.168.0.0/16.
 */
export class Scanner {
	target: string = $state('');
	port: number = $state(8018);
	// Why the target was refused.
	error: string = $state('');

	phase: 'form' | 'running' | 'done' = $state('form');
	// The finished steps, then the one running and how far it got.
	steps: { label: string; detail: string }[] = $state([]);
	running: string = $state('');
	progress: { done: number; total: number } = $state({ done: 0, total: 0 });
	// What the hosts are scanned on; empty until a network is found.
	scope: string = $state('');
	results: ScanResult[] = $state([]);
	// Hosts that answer on the port without allowing this origin (CORS).
	blocked: number = $state(0);

	private controller?: AbortController;

	async start(instances: OdioInstance[]): Promise<void> {
		const target = this.target.trim();
		const parsed = target ? parseScanTarget(target) : null;
		if (parsed && 'error' in parsed) {
			this.error = parsed.error;
			return;
		}
		this.error = '';
		this.steps = [];
		this.results = [];
		this.blocked = 0;
		this.scope = '';
		this.phase = 'running';
		this.controller = new AbortController();
		const { signal } = this.controller;

		let hosts = parsed?.hosts;
		if (hosts) {
			this.scope = target;
		} else {
			const networks = await this.findNetworks(instances, signal);
			if (signal.aborted) return;
			hosts = networks.flatMap(hostsOf);
			this.scope = networks.join(', ');
		}
		if (hosts.length) {
			this.running = `Scanning ${this.scope}…`;
			this.progress = { done: 0, total: hosts.length };
			await scanHosts(hosts, this.port, {
				signal,
				onFound: (result) => this.results.push(result),
				onBlocked: () => this.blocked++,
				onProgress: (done) => (this.progress.done = done),
			});
			if (signal.aborted) return;
		}
		this.phase = 'done';
	}

	private async findNetworks(instances: OdioInstance[], signal: AbortSignal): Promise<string[]> {
		const online = instances.filter((i) => isConnectable(i.status));
		const known = networksOf(online.map((i) => i.host));
		if (known.length) {
			this.steps = known.map((network) => ({
				label: `Network of ${displayName(online.find((i) => networksOf([i.host])[0] === network)!)}`,
				detail: network,
			}));
			return known;
		}

		const candidates = candidateNetworks(instances.map((i) => i.host));
		const searches = [
			{ running: 'Checking common networks…', label: 'Common networks', networks: candidates, samples: 3 },
			{
				running: 'Sweeping 192.168.0.0/16…',
				label: '192.168.0.0/16',
				networks: sweepNetworks(candidates),
				samples: 2,
			},
		];
		for (const search of searches) {
			this.running = search.running;
			this.progress = { done: 0, total: search.networks.length };
			const active = await findActiveNetworks(search.networks, this.port, {
				signal,
				samples: search.samples,
				onProgress: (done) => (this.progress.done = done),
			});
			if (signal.aborted) return [];
			if (active.length) {
				this.steps = [
					{ label: active.length > 1 ? 'Networks found' : 'Network found', detail: active.join(', ') },
				];
				return active;
			}
			this.steps.push({ label: search.label, detail: 'none active' });
		}
		return [];
	}

	// Stopping a scan keeps what it found; stopping while still looking for a
	// network goes back to the form.
	stop(): void {
		this.abort();
		this.phase = this.scope ? 'done' : 'form';
	}

	// Back to the form, target and port as they were.
	edit(): void {
		this.phase = 'form';
	}

	abort(): void {
		this.controller?.abort();
	}
}
