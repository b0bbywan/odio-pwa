import type { MprisPlayer, PlayerPosition, PowerEvent } from './types';
import { baseUrl } from './api';

export interface PlayerEventCallbacks {
	onUpsert: (player: MprisPlayer) => void;
	onRemove: (busName: string) => void;
	onPosition: (updates: PlayerPosition[]) => void;
}

export interface SSEExtraCallbacks {
	onPowerAction?: (action: PowerEvent) => void;
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

	// JSON event data to `handler`; malformed data is ignored.
	function listen<T>(type: string, handler: (data: T) => void) {
		es.addEventListener(type, (e: MessageEvent) => {
			try {
				handler(JSON.parse(e.data) as T);
			} catch { /* ignore malformed data */ }
		});
	}

	es.addEventListener('open', () => onOpen());

	// server.info data: "connected" (on open), "love" (keepalive every 30s), "bye" (shutdown).
	// Not listen(): any event but "bye", even malformed, still proves the stream alive.
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

	const onPowerAction = extra?.onPowerAction;
	if (onPowerAction) {
		listen<{ action: PowerEvent }>('power.action', ({ action }) => onPowerAction(action));
	}

	const players = extra?.players;
	if (players) {
		// player.added / player.updated data: { data: <player>, emitted_at }
		const onUpsert = ({ data }: { data: MprisPlayer }) => players.onUpsert(data);
		listen('player.added', onUpsert);
		listen('player.updated', onUpsert);
		listen<{ bus_name: string }>('player.removed', ({ bus_name }) => players.onRemove(bus_name));
		listen<PlayerPosition[]>('player.position', players.onPosition);
	}

	return () => es.close();
}
