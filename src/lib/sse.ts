import type { MprisPlayer, PlayerPosition } from './types';
import { baseUrl } from './api';

export interface PlayerEventCallbacks {
	onUpsert: (player: MprisPlayer) => void;
	onRemove: (busName: string) => void;
	onPosition: (updates: PlayerPosition[]) => void;
}

export interface SSEExtraCallbacks {
	onPowerAction?: (action: 'reboot' | 'poweroff') => void;
	players?: PlayerEventCallbacks;
}

const PLAYER_TYPES = ['player.added', 'player.updated', 'player.removed', 'player.position'];

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
	if (extra?.players) types.push(...PLAYER_TYPES);

	const es = new EventSource(`${baseUrl(host, port)}/events?types=${types.join(',')}`);

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

	const players = extra?.players;
	if (players) {
		// player.added / player.updated data: { data: <player>, emitted_at }
		const onUpsert = (e: MessageEvent) => {
			try {
				players.onUpsert((JSON.parse(e.data) as { data: MprisPlayer }).data);
			} catch { /* ignore malformed data */ }
		};
		es.addEventListener('player.added', onUpsert);
		es.addEventListener('player.updated', onUpsert);
		es.addEventListener('player.removed', (e: MessageEvent) => {
			try {
				players.onRemove((JSON.parse(e.data) as { bus_name: string }).bus_name);
			} catch { /* ignore malformed data */ }
		});
		es.addEventListener('player.position', (e: MessageEvent) => {
			try {
				players.onPosition(JSON.parse(e.data) as PlayerPosition[]);
			} catch { /* ignore malformed data */ }
		});
	}

	return () => es.close();
}
