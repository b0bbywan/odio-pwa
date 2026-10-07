import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import type { MprisPlayer } from '../lib/types';

vi.mock('../lib/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('../lib/api')>()),
	sendPlayerAction: vi.fn(),
}));

import NowPlayingControls from './NowPlayingControls.svelte';
import { sendPlayerAction } from '../lib/api';

const mpd: MprisPlayer = {
	bus_name: 'org.mpris.MediaPlayer2.mpd',
	identity: 'Music Player Daemon',
	playback_status: 'Playing',
	position_updated_at: '2026-10-06T21:42:48.826Z',
	capabilities: {
		can_play: true,
		can_pause: true,
		can_go_next: false,
		can_go_previous: true,
		can_seek: false,
		can_control: true,
	},
};

function renderWith(player: MprisPlayer) {
	return render(NowPlayingControls, { host: 'raspodio.local', port: 8018, player });
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(sendPlayerAction).mockResolvedValue();
});

describe('NowPlayingControls', () => {
	test('enables controls from capabilities', () => {
		renderWith(mpd);
		expect(screen.getByRole('button', { name: 'Previous' })).not.toBeDisabled();
		expect(screen.getByRole('button', { name: 'Pause' })).not.toBeDisabled();
		expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
	});

	test('disables every control when the player cannot be controlled', () => {
		renderWith({ ...mpd, capabilities: { ...mpd.capabilities, can_control: false } });
		for (const name of ['Previous', 'Pause', 'Next']) {
			expect(screen.getByRole('button', { name })).toBeDisabled();
		}
	});

	test('offers Play while paused, if the player can play', () => {
		renderWith({ ...mpd, playback_status: 'Paused' });
		expect(screen.getByRole('button', { name: 'Play' })).not.toBeDisabled();
	});

	test('disables Play when the player cannot play', () => {
		renderWith({
			...mpd,
			playback_status: 'Paused',
			capabilities: { ...mpd.capabilities, can_play: false },
		});
		expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
	});

	test.each([
		['Previous', 'previous'],
		['Pause', 'play_pause'],
	])('%s sends %s to the player', async (name, action) => {
		renderWith(mpd);
		await fireEvent.click(screen.getByRole('button', { name }));
		expect(sendPlayerAction).toHaveBeenCalledWith(
			'raspodio.local',
			8018,
			'org.mpris.MediaPlayer2.mpd',
			action,
		);
	});

	test('a failed action does not throw', async () => {
		vi.mocked(sendPlayerAction).mockRejectedValue(new Error('HTTP 500'));
		renderWith(mpd);
		await expect(
			fireEvent.click(screen.getByRole('button', { name: 'Pause' })),
		).resolves.not.toThrow();
	});
});
