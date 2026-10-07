import type {
	MprisPlayer,
	OdioServerInfo,
	PlayerAction,
	PowerAction,
	PowerCapabilities,
} from './types';

export function baseUrl(host: string, port: number): string {
	return `http://${host}:${port}`;
}

async function getJson<T>(host: string, port: number, path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${baseUrl(host, port)}${path}`, init);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return (await res.json()) as T;
}

// Bodyless POST: a CORS "simple request", so no preflight. odio-api answers 202.
async function post(host: string, port: number, path: string): Promise<void> {
	const res = await fetch(`${baseUrl(host, port)}${path}`, { method: 'POST' });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export function probeInstance(host: string, port: number, timeoutMs = 3000): Promise<OdioServerInfo> {
	return getJson(host, port, '/server', { signal: AbortSignal.timeout(timeoutMs) });
}

// Tests reachability without requiring CORS headers. A `no-cors` fetch returns
// an opaque response if the network round-trip succeeded — useful to tell
// "server up but missing Access-Control-Allow-Origin" from "server unreachable
// or mixed-content blocked at browser level".
export async function probeReachable(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
	try {
		await fetch(`${baseUrl(host, port)}/server`, {
			mode: 'no-cors',
			signal: AbortSignal.timeout(timeoutMs),
		});
		return true;
	} catch {
		return false;
	}
}

export function getInstanceUiUrl(host: string, port: number): string {
	return `${baseUrl(host, port)}/ui`;
}

export function fetchPlayers(host: string, port: number): Promise<MprisPlayer[]> {
	return getJson(host, port, '/players');
}

export function sendPlayerAction(
	host: string,
	port: number,
	busName: string,
	action: PlayerAction,
): Promise<void> {
	return post(host, port, `/players/${encodeURIComponent(busName)}/${action}`);
}

export function fetchPowerCapabilities(host: string, port: number): Promise<PowerCapabilities> {
	return getJson(host, port, '/power');
}

// 403 when login1 doesn't allow the action.
export function sendPowerAction(host: string, port: number, action: PowerAction): Promise<void> {
	return post(host, port, `/power/${action}`);
}

// The cover path is stable per player, so the art URL rides along as a
// cache-buster (odio-api ignores the query) to refresh the image on track change.
export function getPlayerCoverUrl(
	host: string,
	port: number,
	busName: string,
	artUrl: string,
): string {
	return `${baseUrl(host, port)}/players/${encodeURIComponent(busName)}/cover?art=${encodeURIComponent(artUrl)}`;
}
