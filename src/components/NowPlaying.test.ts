import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import type { MprisPlayer } from '../lib/types';

import NowPlaying from './NowPlaying.svelte';

const mpd: MprisPlayer = {
	bus_name: 'org.mpris.MediaPlayer2.mpd',
	identity: 'Music Player Daemon',
	playback_status: 'Playing',
	position: 35_193_000,
	position_updated_at: '2026-10-06T21:42:48.826Z',
	metadata: {
		'mpris:artUrl': 'https://example.com/radio.webp',
		'xesam:album': 'La Grosse Radio Reggae',
		'xesam:title': 'Naaman - Coco Wata',
	},
	capabilities: {
		can_play: true,
		can_pause: true,
		can_go_next: false,
		can_go_previous: true,
		can_seek: false,
		can_control: true,
	},
};

const qbz: MprisPlayer = {
	...mpd,
	bus_name: 'org.mpris.MediaPlayer2.com.blitzfc.qbz',
	identity: 'QBZ',
	playback_status: 'Paused',
	position: 72_000_000,
	metadata: {
		'mpris:length': '194000000',
		'xesam:album': 'Carnet de NOTES',
		'xesam:artist': "Les P'tits Yeux",
		'xesam:title': "Tu m'as perdue",
	},
	capabilities: { ...mpd.capabilities, can_go_next: true },
};

const snapcast: MprisPlayer = { ...mpd, bus_name: 'org.mpris.MediaPlayer2.snapcast', identity: 'Snapcast client', playback_status: 'Stopped' };

function renderWith(players: MprisPlayer[]) {
	return render(NowPlaying, { host: 'raspodio.local', port: 8018, players });
}

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

	test('switching tab shows the other player', async () => {
		renderWith([mpd, qbz]);
		await fireEvent.click(screen.getByRole('tab', { name: /QBZ/ }));
		expect(screen.getByText("Tu m'as perdue")).toBeInTheDocument();
	});
});
