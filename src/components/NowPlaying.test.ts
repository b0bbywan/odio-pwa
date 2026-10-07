import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import type { MprisPlayer } from '../lib/types';

vi.mock('../lib/api', async (importOriginal) => ({
	...(await importOriginal<typeof import('../lib/api')>()),
	sendPlayerAction: vi.fn(),
}));

import NowPlaying from './NowPlaying.svelte';
import { sendPlayerAction } from '../lib/api';
import { mpdPlayer, qbzPlayer, snapcastPlayer } from '../test/fixtures';

const mpd = mpdPlayer();
const qbz = qbzPlayer();
const snapcast = snapcastPlayer();

function renderWith(players: MprisPlayer[]) {
	return render(NowPlaying, { host: 'raspodio.local', port: 8018, players });
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(sendPlayerAction).mockResolvedValue();
});

describe('NowPlaying — visibility', () => {
	test('renders nothing when only stopped players exist', () => {
		renderWith([snapcast]);
		expect(screen.queryByRole('region', { name: 'Now playing' })).not.toBeInTheDocument();
	});
});

describe('NowPlaying — track', () => {
	test('shows the player name, the raw title and the album', () => {
		renderWith([mpd]);
		expect(screen.getByText('Music Player Daemon')).toBeInTheDocument();
		expect(screen.getByText('Naaman - Coco Wata')).toBeInTheDocument();
		expect(screen.getByText('La Grosse Radio Reggae')).toBeInTheDocument();
	});

	test('falls back to the player identity without a title', () => {
		renderWith([{ ...mpd, metadata: {} }]);
		expect(screen.getAllByText('Music Player Daemon')).toHaveLength(2);
	});

	test('shows the paused state and the artist', () => {
		renderWith([qbz]);
		expect(screen.getByText('QBZ · Paused')).toBeInTheDocument();
		expect(screen.getByText("Les P'tits Yeux")).toBeInTheDocument();
	});
});

describe('NowPlaying — several active players', () => {
	test('shows a tab per active player, playing one selected first', () => {
		renderWith([qbz, snapcast, mpd]);
		const tabs = screen.getAllByRole('tab');
		expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Music Player Daemon', 'QBZ']);
		expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
		expect(screen.getByText('Naaman - Coco Wata')).toBeInTheDocument();
	});

	test('switching tab shows and controls the other player', async () => {
		renderWith([mpd, qbz]);
		await fireEvent.click(screen.getByRole('tab', { name: /QBZ/ }));
		expect(screen.getByText("Tu m'as perdue")).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'Next' }));
		expect(sendPlayerAction).toHaveBeenCalledWith(
			'raspodio.local',
			8018,
			'org.mpris.MediaPlayer2.com.blitzfc.qbz',
			'next',
		);
	});
});
