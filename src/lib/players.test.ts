import { describe, test, expect } from 'vitest';
import {
	activePlayers,
	applyPositions,
	currentPosition,
	formatTime,
	removePlayer,
	trackLength,
	upsertPlayer,
} from './players';
import { mpdPlayer as player, qbzPlayer, snapcastPlayer } from '../test/fixtures';

const qbz = qbzPlayer();
const snapcast = snapcastPlayer();

describe('upsertPlayer', () => {
	test('appends an unknown player', () => {
		expect(upsertPlayer([player()], qbz)).toEqual([player(), qbz]);
	});

	test('replaces a known player in place', () => {
		const paused = player({ playback_status: 'Paused' });
		expect(upsertPlayer([player(), qbz], paused)).toEqual([paused, qbz]);
	});
});

describe('removePlayer', () => {
	test('drops the player with that bus name', () => {
		expect(removePlayer([player(), qbz], qbz.bus_name)).toEqual([player()]);
	});

	test('is a no-op for an unknown bus name', () => {
		expect(removePlayer([player()], 'org.mpris.MediaPlayer2.vlc')).toEqual([player()]);
	});
});

describe('applyPositions', () => {
	test('updates position and sample time of matching players only', () => {
		const result = applyPositions(
			[player(), qbz],
			[{ bus_name: player().bus_name, position: 1_456_704_000, emitted_at: 1791324393825 }],
		);
		expect(result[0].position).toBe(1_456_704_000);
		expect(result[0].position_updated_at).toBe(new Date(1791324393825).toISOString());
		expect(result[1]).toBe(qbz);
	});
});

describe('activePlayers', () => {
	test('puts playing before paused and leaves stopped out', () => {
		expect(activePlayers([qbz, snapcast, player()])).toEqual([player(), qbz]);
	});

	test('is empty when nothing plays', () => {
		expect(activePlayers([snapcast])).toEqual([]);
	});
});

describe('trackLength', () => {
	test('parses mpris:length', () => {
		expect(trackLength(qbz)).toBe(194_000_000);
	});

	test.each([undefined, '0', 'garbage'])('is undefined for %s', (length) => {
		const metadata: Record<string, string> = length === undefined ? {} : { 'mpris:length': length };
		expect(trackLength(player({ metadata }))).toBeUndefined();
	});
});

describe('currentPosition', () => {
	const sampledAt = Date.parse('2026-10-06T21:42:48.826Z');

	test('extrapolates while playing', () => {
		expect(currentPosition(player(), sampledAt + 2_000)).toBe(37_193_000);
	});

	test('honours the playback rate', () => {
		expect(currentPosition(player({ rate: 2 }), sampledAt + 1_000)).toBe(37_193_000);
	});

	test('stays put while paused', () => {
		expect(currentPosition(player({ playback_status: 'Paused' }), sampledAt + 60_000)).toBe(
			35_193_000,
		);
	});

	test('is clamped to the track length', () => {
		const p = player({ metadata: { 'mpris:length': '40000000' } });
		expect(currentPosition(p, sampledAt + 60_000)).toBe(40_000_000);
	});

	test('never goes back when the client clock is behind', () => {
		expect(currentPosition(player(), sampledAt - 5_000)).toBe(35_193_000);
	});

	test('defaults to 0 without a position', () => {
		expect(currentPosition(player({ position: undefined, playback_status: 'Paused' }))).toBe(0);
	});
});

describe('formatTime', () => {
	test.each([
		[0, '0:00'],
		[72_000_000, '1:12'],
		[194_000_000, '3:14'],
		[3_725_000_000, '1:02:05'],
	])('%i µs → %s', (us, expected) => {
		expect(formatTime(us)).toBe(expected);
	});
});
