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

export function getInstanceUiUrl(host: string, port: number): string {
	return `http://${host}:${port}/ui`;
}
