export interface SSEExtraCallbacks {
	onPowerAction?: (action: 'reboot' | 'poweroff') => void;
}

export function connectSSE(
	host: string,
	port: number,
	onOpen: () => void,
	onAlive: () => void,
	onOffline: () => void,
	extra?: SSEExtraCallbacks,
): () => void {
	const types = ['server.info'];
	if (extra?.onPowerAction) types.push('power.action');

	const es = new EventSource(`http://${host}:${port}/events?types=${types.join(',')}`);

	es.addEventListener('open', () => onOpen());

	// server.info data: "connected" (on open), "love" (keepalive every 30s), "bye" (shutdown)
	es.addEventListener('server.info', (e: MessageEvent) => {
		try {
			if (JSON.parse(e.data) === 'bye') {
				onOffline();
				return;
			}
		} catch { /* ignore malformed data */ }
		onAlive();
	});

	// onerror fires on connection failure/drop
	es.addEventListener('error', () => onOffline());

	if (extra?.onPowerAction) {
		es.addEventListener('power.action', (e: MessageEvent) => {
			try {
				const { action } = JSON.parse(e.data) as { action: 'reboot' | 'poweroff' };
				extra.onPowerAction!(action);
			} catch { /* ignore malformed data */ }
		});
	}

	return () => es.close();
}
