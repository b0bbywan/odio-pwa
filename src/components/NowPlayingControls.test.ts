import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import type { MprisPlayer } from '../lib/types';

vi.mock('../lib/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('../lib/api')>()),
	sendPlayerAction: vi.fn(),
}));

import NowPlayingControls from './NowPlayingControls.svelte';
import { sendPlayerAction } from '../lib/api';
import { mpdPlayer } from '../test/fixtures';

const mpd = mpdPlayer();

function renderWith(player: MprisPlayer) {
	return render(NowPlayingControls, { host: 'raspodio.local', port: 8018, player });
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(sendPlayerAction).mockResolvedValue();
});

describe('NowPlayingControls', () => {
	test('shows only the commands the player supports', () => {
		renderWith(mpd);
		expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
	});

	test('a missing command keeps its slot, so the others stay in place', () => {
		const { container } = renderWith(mpd);
		const row = [...container.querySelector('.np-controls')!.children];
		expect(row.map((el) => el.className)).toEqual(['np-btn', 'np-btn primary', 'np-btn-slot']);
	});

	test('renders nothing when the player cannot be controlled', () => {
		const { container } = renderWith({
			...mpd,
			capabilities: { ...mpd.capabilities, can_control: false },
		});
		expect(container.querySelector('.np-controls')).toBeNull();
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});

	// A Snapcast client: controllable on paper, but with no command at all.
	test('renders nothing when no command is available', () => {
		const { container } = renderWith({
			...mpd,
			capabilities: {
				...mpd.capabilities,
				can_play: false,
				can_pause: false,
				can_go_next: false,
				can_go_previous: false,
			},
		});
		expect(container.querySelector('.np-controls')).toBeNull();
	});

	test('offers Play while paused, if the player can play', () => {
		renderWith({ ...mpd, playback_status: 'Paused' });
		expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
	});

	test('hides Play when the player cannot play', () => {
		renderWith({
			...mpd,
			playback_status: 'Paused',
			capabilities: { ...mpd.capabilities, can_play: false },
		});
		expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument();
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
