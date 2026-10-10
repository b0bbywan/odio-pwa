import { describe, test, expect } from 'vitest';
import { ListPlacements } from './placement.svelte';
import type { MprisPlayer, OdioInstance } from './types';
import { mpdPlayer, qbzPlayer } from '../test/fixtures';

function inst(id: string, status: OdioInstance['status']): OdioInstance {
	return { id, host: id, port: 8018, status };
}

const ids = (list: OdioInstance[]) => list.map((i) => i.id);

describe('ListPlacements', () => {
	test('moves unreachable instances last, keeping user order in each group', () => {
		const list = [
			inst('local', 'offline'),
			inst('raspodio', 'online'),
			inst('nas', 'blocked'),
			inst('htpc', 'cors'),
		];
		const p = new ListPlacements();
		p.update(list);
		expect(ids(p.order(list))).toEqual(['raspodio', 'htpc', 'local', 'nas']);
	});

	test('leaves unsettled instances in place', () => {
		const list = [inst('local', 'probing'), inst('raspodio', 'unknown')];
		const p = new ListPlacements();
		p.update(list);
		expect(ids(p.order(list))).toEqual(['local', 'raspodio']);
	});

	test('places an instance on its first settled status', () => {
		const p = new ListPlacements();
		p.update([inst('local', 'probing'), inst('raspodio', 'online')]);
		const settled = [inst('local', 'offline'), inst('raspodio', 'online')];
		p.update(settled);
		expect(ids(p.order(settled))).toEqual(['raspodio', 'local']);
	});

	test('does not move an instance on a later status change', () => {
		const p = new ListPlacements();
		p.update([inst('local', 'online'), inst('raspodio', 'online')]);
		const flapped = [inst('local', 'offline'), inst('raspodio', 'online')];
		p.update(flapped);
		expect(ids(p.order(flapped))).toEqual(['local', 'raspodio']);
	});

	test('markStale re-places on the next settled status, not while probing', () => {
		const p = new ListPlacements();
		p.update([inst('local', 'offline'), inst('raspodio', 'online')]);
		p.markStale();

		const probing = [inst('local', 'probing'), inst('raspodio', 'probing')];
		p.update(probing);
		expect(ids(p.order(probing))).toEqual(['raspodio', 'local']);

		const back = [inst('local', 'online'), inst('raspodio', 'offline')];
		p.update(back);
		expect(ids(p.order(back))).toEqual(['local', 'raspodio']);
	});

	// ── playing first ────────────────────────────────────────────────────────

	const playing = [mpdPlayer()];
	const paused = [qbzPlayer()];

	function withPlayers(id: string, players: MprisPlayer[] | undefined): OdioInstance {
		return { ...inst(id, 'online'), players };
	}

	test('playing first, then paused, idle and unreachable, in user order', () => {
		const list = [
			withPlayers('nas', []),
			withPlayers('kitchen', paused),
			withPlayers('raspodio', playing),
			inst('htpc', 'offline'),
			withPlayers('office', paused),
			withPlayers('desktop', playing),
			withPlayers('attic', undefined),
		];
		const p = new ListPlacements();
		p.update(list);
		expect(ids(p.order(list))).toEqual([
			'raspodio',
			'desktop',
			'kitchen',
			'office',
			'nas',
			'attic',
			'htpc',
		]);
	});

	test('one playing player is enough, whatever the others do', () => {
		const list = [withPlayers('kitchen', paused), withPlayers('raspodio', [...paused, ...playing])];
		const p = new ListPlacements();
		p.update(list);
		expect(ids(p.order(list))).toEqual(['raspodio', 'kitchen']);
	});

	test('places an instance once more when its players arrive', () => {
		const p = new ListPlacements();
		// Online first, the player snapshot follows.
		p.update([withPlayers('nas', undefined), withPlayers('raspodio', undefined)]);
		const known = [withPlayers('nas', []), withPlayers('raspodio', playing)];
		p.update(known);
		expect(ids(p.order(known))).toEqual(['raspodio', 'nas']);
	});

	test('does not move an instance when a player starts or stops later', () => {
		const p = new ListPlacements();
		p.update([withPlayers('nas', []), withPlayers('raspodio', playing)]);
		const swapped = [withPlayers('nas', playing), withPlayers('raspodio', [])];
		p.update(swapped);
		expect(ids(p.order(swapped))).toEqual(['raspodio', 'nas']);
	});

	test('a flap while awaiting players does not send the card to the bottom', () => {
		const p = new ListPlacements();
		p.update([withPlayers('raspodio', undefined), withPlayers('nas', undefined)]);
		// SSE dropped right after the snapshot: players known, status offline.
		const flapped = [{ ...inst('raspodio', 'offline'), players: [] }, withPlayers('nas', [])];
		p.update(flapped);
		expect(ids(p.order(flapped))).toEqual(['raspodio', 'nas']);
	});

	test('markStale re-places from the fresh player snapshot', () => {
		const p = new ListPlacements();
		p.update([withPlayers('nas', []), withPlayers('raspodio', playing)]);
		p.markStale();

		// Back online, players not known yet: the playing card holds its spot.
		const online = [withPlayers('nas', undefined), withPlayers('raspodio', undefined)];
		p.update(online);
		expect(ids(p.order(online))).toEqual(['raspodio', 'nas']);

		const fresh = [withPlayers('nas', playing), withPlayers('raspodio', [])];
		p.update(fresh);
		expect(ids(p.order(fresh))).toEqual(['nas', 'raspodio']);
	});

	test('a paused card holds its spot too while refreshing', () => {
		const p = new ListPlacements();
		p.update([withPlayers('nas', []), withPlayers('kitchen', paused)]);
		p.markStale();
		const online = [withPlayers('nas', undefined), withPlayers('kitchen', undefined)];
		p.update(online);
		expect(ids(p.order(online))).toEqual(['kitchen', 'nas']);
	});
});
