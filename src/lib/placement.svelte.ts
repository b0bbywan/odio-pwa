import { SvelteSet } from 'svelte/reactivity';
import type { OdioInstance } from './types';
import { isConnectable } from './instance';

type Placement = 'top' | 'bottom';

// Which end of the list an instance belongs to once its status is settled;
// null while it is still unknown or probing.
function placementOf(status: OdioInstance['status']): Placement | null {
	if (isConnectable(status)) return 'top';
	if (status === 'offline' || status === 'blocked') return 'bottom';
	return null;
}

/**
 * Display order of the instance list: unreachable instances last, user order
 * otherwise. Each instance is placed on its first settled status, then frozen
 * until markStale(): cards must not jump around on a live status flap while
 * the user aims at one of them.
 */
export class ListPlacements {
	private placements = $state<Record<string, Placement>>({});
	// Placed before markStale(): they keep their spot while probing again and
	// are re-placed on their next settled status.
	private stale = new SvelteSet<string>();

	update(instances: OdioInstance[]): void {
		for (const inst of instances) {
			if (this.placements[inst.id] && !this.stale.has(inst.id)) continue;
			const placement = placementOf(inst.status);
			if (!placement) continue;
			this.placements[inst.id] = placement;
			this.stale.delete(inst.id);
		}
	}

	markStale(): void {
		for (const id of Object.keys(this.placements)) this.stale.add(id);
	}

	// Instances without a placement yet stay at the top so nothing moves
	// before it has to.
	order(instances: OdioInstance[]): OdioInstance[] {
		return [
			...instances.filter((i) => this.placements[i.id] !== 'bottom'),
			...instances.filter((i) => this.placements[i.id] === 'bottom'),
		];
	}
}
