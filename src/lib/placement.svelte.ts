import { SvelteSet } from 'svelte/reactivity';
import type { OdioInstance } from './types';
import { isConnectable } from './instance';

// In display order.
const PLACEMENTS = ['playing', 'paused', 'idle', 'unreachable'] as const;
type Placement = (typeof PLACEMENTS)[number];

// Which group of the list an instance belongs to once its status is settled;
// null while it is still unknown or probing.
function placementOf(inst: OdioInstance): Placement | null {
	if (inst.status === 'offline' || inst.status === 'blocked') return 'unreachable';
	if (!isConnectable(inst.status)) return null;
	const players = (inst.status === 'online' && inst.players) || [];
	if (players.some((p) => p.playback_status === 'Playing')) return 'playing';
	if (players.some((p) => p.playback_status === 'Paused')) return 'paused';
	return 'idle';
}

/**
 * Display order of the instance list: instances playing something first,
 * then those with a paused player, idle ones, and unreachable ones last;
 * user order within each group. Each instance is
 * placed on its first settled status, then frozen until markStale(): cards
 * must not jump around on a live status flap, or when a player starts or
 * stops, while the user aims at one of them.
 */
export class ListPlacements {
	private placements = $state<Record<string, Placement>>({});
	// Placed before markStale(): they keep their spot while probing again and
	// are re-placed on their next settled status.
	private stale = new SvelteSet<string>();
	// Placed as reachable before their players were known (the snapshot comes
	// a moment after the status): placed once more when it arrives.
	private awaitingPlayers = new SvelteSet<string>();

	update(instances: OdioInstance[]): void {
		for (const inst of instances) {
			const placed = this.placements[inst.id] !== undefined;
			const stale = this.stale.has(inst.id);
			const playersKnown = inst.players !== undefined;
			const playersArrived = this.awaitingPlayers.has(inst.id) && playersKnown;
			if (placed && !stale && !playersArrived) continue;

			const placement = placementOf(inst);
			if (!placement) continue;
			// Only the players were awaited: a status flap in between must not
			// send the card to the bottom.
			if (placed && !stale && placement === 'unreachable') continue;
			// Refreshed while it had a player: hold its spot until the new
			// snapshot tells, rather than dropping to idle and coming straight back.
			const hadPlayer = ['playing', 'paused'].includes(this.placements[inst.id]);
			if (hadPlayer && placement === 'idle' && !playersKnown) continue;

			this.placements[inst.id] = placement;
			this.stale.delete(inst.id);
			if (placement !== 'unreachable' && !playersKnown) this.awaitingPlayers.add(inst.id);
			else this.awaitingPlayers.delete(inst.id);
		}
	}

	markStale(): void {
		for (const id of Object.keys(this.placements)) this.stale.add(id);
	}

	// Instances without a placement yet sit with the idle ones so nothing
	// moves before it has to.
	order(instances: OdioInstance[]): OdioInstance[] {
		return PLACEMENTS.flatMap((placement) =>
			instances.filter((i) => (this.placements[i.id] ?? 'idle') === placement),
		);
	}
}
