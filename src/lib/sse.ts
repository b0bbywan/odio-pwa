import type { OdioServerInfo } from './types';

export function connectSSE(
	host: string,
	port: number,
	onOpen: () => void,
	onInfo: (info: OdioServerInfo) => void,
	onOffline: () => void,
): () => void {
	const es = new EventSource(`http://${host}:${port}/events?types=server.info`);

	es.addEventListener('open', () => {
		onOpen();
	});

	es.addEventListener('server.info', (e: MessageEvent) => {
		try {
			onInfo(JSON.parse(e.data) as OdioServerInfo);
		} catch {
			// ignore malformed event data
		}
	});

	// onerror fires both on initial failure and on dropped connections;
	// EventSource auto-retries so we just mark offline and wait for next server.info
	es.addEventListener('error', () => {
		onOffline();
	});

	return () => es.close();
}
