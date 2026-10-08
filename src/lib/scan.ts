import { baseUrl, probeInstance, probeReachable } from './api';
import type { OdioServerInfo } from './types';

// Biggest network a single scan accepts: a /22 is 1022 hosts.
const MIN_PREFIX = 22;

// Chrome queues requests past 256 open sockets, and a queued probe would
// burn its timeout waiting: stay under, with room for the app's own
// connections.
const LINK_CONCURRENCY = 192;

// 192.168.x.0/24 defaults of home routers, ISP boxes and hotspots around the
// world (Huawei 3 and 8, Buffalo 11, Jio 29, Xiaomi 31, FRITZ!Box 178,
// LG U+ 219, Globe 254...). Checked first when the user gives no target.
const COMMON_192_168 = [
	0, 1, 2, 3, 4, 5, 8, 10, 11, 12, 15, 25, 29, 31, 35, 43, 45, 50, 62, 68, 86, 88, 100, 110, 124,
	128, 137, 178, 179, 199, 219, 254,
];

// 10.0.0.0/8 and 172.16.0.0/12 are too large to sweep: known defaults only.
const COMMON_OTHER = [
	'10.0.0.0/24', // Xfinity, Telstra
	'10.0.1.0/24', // Apple AirPort
	'10.1.10.0/24', // Comcast Business
	'10.42.0.0/24', // NetworkManager hotspot
	'172.16.0.0/24',
	'172.20.10.0/28', // iPhone hotspot
	'172.30.1.0/24', // KT (Korea)
];

export interface ScanResult {
	host: string;
	info: OdioServerInfo;
}

function parseIpv4(s: string): number | null {
	const parts = s.split('.');
	if (parts.length !== 4) return null;
	let n = 0;
	for (const part of parts) {
		if (!/^\d{1,3}$/.test(part)) return null;
		const byte = Number(part);
		if (byte > 255) return null;
		n = n * 256 + byte;
	}
	return n;
}

function formatIpv4(n: number): string {
	return [24, 16, 8, 0].map((shift) => (n >>> shift) & 255).join('.');
}

// "24" or "255.255.255.0". Rejects non-contiguous masks.
function parsePrefix(s: string): number | null {
	if (/^\d{1,2}$/.test(s)) {
		const prefix = Number(s);
		return prefix <= 32 ? prefix : null;
	}
	const mask = parseIpv4(s);
	if (mask === null) return null;
	const inverted = ~mask >>> 0;
	if ((inverted & (inverted + 1)) !== 0) return null;
	return 32 - Math.log2(inverted + 1);
}

// Every usable host of the network: network and broadcast addresses are
// skipped, except on /31 and /32 where there are none.
function networkHosts(base: number, prefix: number): string[] {
	const size = 2 ** (32 - prefix);
	const network = base - (base % size);
	if (size <= 2) return Array.from({ length: size }, (_, i) => formatIpv4(network + i));
	return Array.from({ length: size - 2 }, (_, i) => formatIpv4(network + i + 1));
}

// Accepts a single IP or hostname, "192.168.1.0/24" or
// "192.168.1.0/255.255.255.0".
export function parseScanTarget(input: string): { hosts: string[] } | { error: string } {
	const target = input.trim();
	const slash = target.indexOf('/');
	if (slash === -1) return target ? { hosts: [target] } : { error: 'Enter an IP or a network' };

	const base = parseIpv4(target.slice(0, slash));
	const prefix = parsePrefix(target.slice(slash + 1));
	if (base === null || prefix === null) return { error: 'Invalid network' };
	if (prefix < MIN_PREFIX) return { error: `Network too large (max /${MIN_PREFIX})` };
	return { hosts: networkHosts(base, prefix) };
}

// The /24 each IPv4 host is assumed to be on, in CIDR notation and without
// duplicates; hostnames are skipped. Those of the instances online are
// known to be reachable: scan them straight away, no need to look for a
// network.
export function networksOf(hosts: string[]): string[] {
	const networks = new Set<string>();
	for (const host of hosts) {
		const ip = parseIpv4(host);
		if (ip !== null) networks.add(`${formatIpv4(ip - (ip % 256))}/24`);
	}
	return [...networks];
}

// The networks to try when no instance is online: those of the instances
// already known (likely the user's LAN), then the common defaults.
export function candidateNetworks(knownHosts: string[]): string[] {
	const networks = new Set(networksOf(knownHosts));
	for (const octet of COMMON_192_168) networks.add(`192.168.${octet}.0/24`);
	for (const network of COMMON_OTHER) networks.add(network);
	return [...networks];
}

// Every other /24 of 192.168.0.0/16, to sweep when no candidate is active:
// odd router defaults, and Android hotspots which pick theirs at random.
export function sweepNetworks(exclude: string[]): string[] {
	const excluded = new Set(exclude);
	return Array.from({ length: 256 }, (_, octet) => `192.168.${octet}.0/24`).filter(
		(network) => !excluded.has(network),
	);
}

// Runs `task` over the items, `concurrency` at a time, until `signal` aborts.
async function pool<T>(
	items: T[],
	concurrency: number,
	signal: AbortSignal,
	task: (item: T) => Promise<void>,
): Promise<void> {
	let next = 0;
	async function worker() {
		while (next < items.length && !signal.aborted) await task(items[next++]);
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

// Whether the network said anything about this host. On a directly connected
// network the OS gives up on an unassigned IP once ARP fails (~3 s on Linux)
// and fetch rejects with a TypeError; a host that is up answers or refuses
// the connection. Packets to a network that isn't routed are dropped
// upstream, so the fetch hangs until the timeout.
async function linkAnswers(host: string, port: number, signal: AbortSignal): Promise<boolean> {
	try {
		await fetch(`${baseUrl(host, port)}/`, { mode: 'no-cors', signal });
		return true;
	} catch (e) {
		const name = (e as Error).name;
		return name !== 'TimeoutError' && name !== 'AbortError';
	}
}

// Up to three hosts to judge a network by: two random ones from its top
// quarter, the likeliest to be unassigned, then the usual gateway, which
// answers at once when it refuses the port but may also silently drop it.
function sampleHosts(network: string, count: number): string[] {
	const [base, prefix] = network.split('/');
	const size = 2 ** (32 - Number(prefix));
	const top = parseIpv4(base)! + size * 0.75;
	const random = () => top + Math.floor(Math.random() * (size / 4 - 1));
	return [random(), random(), parseIpv4(base)! + 1].slice(0, count).map(formatIpv4);
}

// The networks (from candidateNetworks or sweepNetworks) that are directly
// connected, in the given order. Each probe hangs for `timeoutMs` on a
// network that isn't there.
export async function findActiveNetworks(
	networks: string[],
	port: number,
	{
		signal,
		onProgress,
		samples = 3,
		timeoutMs = 5000,
	}: {
		signal: AbortSignal;
		onProgress?: (done: number) => void;
		samples?: number;
		timeoutMs?: number;
	},
): Promise<string[]> {
	const active = new Set<string>();
	const pending = new Map(networks.map((network) => [network, samples]));
	const probes = networks.flatMap((network) =>
		sampleHosts(network, samples).map((host) => ({ network, host })),
	);
	let done = 0;
	await pool(probes, LINK_CONCURRENCY, signal, async ({ network, host }) => {
		const probeSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
		if (await linkAnswers(host, port, probeSignal)) active.add(network);
		const left = pending.get(network)! - 1;
		pending.set(network, left);
		if (left === 0 && !signal.aborted) onProgress?.(++done);
	});
	if (signal.aborted) return [];
	return networks.filter((network) => active.has(network));
}

// Probes the hosts, `concurrency` at a time. Stops picking new hosts once
// `signal` aborts; the probes in flight are dropped.
//
// `onBlocked` gets the hosts that answer on the port without allowing this
// origin: their answer can't be read, so they may not be odio-api.
export async function scanHosts(
	hosts: string[],
	port: number,
	{
		signal,
		onFound,
		onBlocked,
		onProgress,
		concurrency = 48,
		timeoutMs = 1500,
	}: {
		signal: AbortSignal;
		onFound: (result: ScanResult) => void;
		onBlocked?: (host: string) => void;
		onProgress: (done: number) => void;
		concurrency?: number;
		timeoutMs?: number;
	},
): Promise<void> {
	let done = 0;
	await pool(hosts, concurrency, signal, async (host) => {
		try {
			const info = await probeInstance(host, port, timeoutMs);
			if (!signal.aborted) onFound({ host, info });
		} catch (e) {
			// fetch rejects with a TypeError when the port is closed and when
			// CORS hides the answer: a no-cors request tells them apart. A
			// host that timed out isn't there, no need to ask again.
			const refused = (e as Error).name === 'TypeError';
			if (refused && (await probeReachable(host, port, timeoutMs)) && !signal.aborted) {
				onBlocked?.(host);
			}
		}
		if (!signal.aborted) onProgress(++done);
	});
}
