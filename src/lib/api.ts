import type { OdioServerInfo } from './types';

export async function probeInstance(
	host: string,
	port: number,
	timeoutMs = 3000,
): Promise<OdioServerInfo> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(`http://${host}:${port}/server`, {
			signal: controller.signal,
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return (await res.json()) as OdioServerInfo;
	} finally {
		clearTimeout(timer);
	}
}

// Tests reachability without requiring CORS headers. A `no-cors` fetch returns
// an opaque response if the network round-trip succeeded — useful to tell
// "server up but missing Access-Control-Allow-Origin" from "server unreachable
// or mixed-content blocked at browser level".
export async function probeReachable(
	host: string,
	port: number,
	timeoutMs = 3000,
): Promise<boolean> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		await fetch(`http://${host}:${port}/server`, {
			mode: 'no-cors',
			signal: controller.signal,
		});
		return true;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}

export function getInstanceUiUrl(host: string, port: number): string {
	return `http://${host}:${port}/ui`;
}
