import { describe, test, expect } from 'vitest';
import { ListPlacements } from './placement.svelte';
import type { OdioInstance } from './types';

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
});
