import type { MprisPlayer } from '../lib/types';

// MPRIS players as raspodio reported them: MPD on a webradio (no length,
// no next), QBZ paused on a track, an idle Snapcast client.

export function mpdPlayer(overrides: Partial<MprisPlayer> = {}): MprisPlayer {
	return {
		bus_name: 'org.mpris.MediaPlayer2.mpd',
		identity: 'Music Player Daemon',
		playback_status: 'Playing',
		position: 35_193_000,
		position_updated_at: '2026-10-06T21:42:48.826Z',
		rate: 1,
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
		...overrides,
	};
}

export function qbzPlayer(overrides: Partial<MprisPlayer> = {}): MprisPlayer {
	return mpdPlayer({
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
		capabilities: { ...mpdPlayer().capabilities, can_go_next: true },
		...overrides,
	});
}

export function snapcastPlayer(overrides: Partial<MprisPlayer> = {}): MprisPlayer {
	return mpdPlayer({
		bus_name: 'org.mpris.MediaPlayer2.snapcast',
		identity: 'Snapcast client',
		playback_status: 'Stopped',
		...overrides,
	});
}
