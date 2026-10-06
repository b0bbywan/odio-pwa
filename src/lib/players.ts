import type { MprisPlayer, PlayerPosition } from './types';

export function upsertPlayer(players: MprisPlayer[], player: MprisPlayer): MprisPlayer[] {
	const idx = players.findIndex((p) => p.bus_name === player.bus_name);
	if (idx === -1) return [...players, player];
	return players.map((p, i) => (i === idx ? player : p));
}

export function removePlayer(players: MprisPlayer[], busName: string): MprisPlayer[] {
	return players.filter((p) => p.bus_name !== busName);
}

export function applyPositions(players: MprisPlayer[], updates: PlayerPosition[]): MprisPlayer[] {
	return players.map((p) => {
		const u = updates.find((u) => u.bus_name === p.bus_name);
		if (!u) return p;
		return {
			...p,
			position: u.position,
			position_updated_at: new Date(u.emitted_at).toISOString(),
		};
	});
}

// Players worth showing: playing ones first, then paused. Stopped players
// (idle snapcast, shairport waiting for a client…) are left out.
export function activePlayers(players: MprisPlayer[]): MprisPlayer[] {
	return [
		...players.filter((p) => p.playback_status === 'Playing'),
		...players.filter((p) => p.playback_status === 'Paused'),
	];
}

// Track length in microseconds; undefined for streams without a duration.
export function trackLength(player: MprisPlayer): number | undefined {
	const length = Number(player.metadata?.['mpris:length']);
	return length > 0 ? length : undefined;
}

// Position in microseconds at `now`, extrapolated from the last sample while
// playing so a progress bar can advance between the 5 s heartbeats.
export function currentPosition(player: MprisPlayer, now = Date.now()): number {
	const position = player.position ?? 0;
	if (player.playback_status !== 'Playing') return position;
	const sampledAt = Date.parse(player.position_updated_at);
	if (Number.isNaN(sampledAt)) return position;
	const elapsed = Math.max(0, now - sampledAt) * 1000 * (player.rate ?? 1);
	const length = trackLength(player);
	return length === undefined ? position + elapsed : Math.min(position + elapsed, length);
}

export function formatTime(us: number): string {
	const total = Math.floor(us / 1_000_000);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = String(total % 60).padStart(2, '0');
	return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
