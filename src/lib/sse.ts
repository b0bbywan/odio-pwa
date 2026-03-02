export function connectSSE(
	host: string,
	port: number,
	onOpen: () => void,
	onAlive: () => void,
	onOffline: () => void,
): () => void {
	const es = new EventSource(`http://${host}:${port}/events?types=server.info`);

	es.addEventListener('open', () => {
		onOpen();
	});

	// server.info events are keepalives — signal aliveness only, data comes from GET /server
	es.addEventListener('server.info', () => {
		onAlive();
	});

	// onerror fires both on initial failure and on dropped connections;
	// EventSource auto-retries so we just mark offline and wait for next server.info
	es.addEventListener('error', () => {
		onOffline();
	});

	return () => es.close();
}
