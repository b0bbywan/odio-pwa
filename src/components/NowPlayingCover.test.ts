import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import type { MprisPlayer } from '../lib/types';
import NowPlayingCover from './NowPlayingCover.svelte';

const mpd: MprisPlayer = {
	bus_name: 'org.mpris.MediaPlayer2.mpd',
	identity: 'Music Player Daemon',
	playback_status: 'Playing',
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

const coverSrc =
	'http://raspodio.local:8018/players/org.mpris.MediaPlayer2.mpd/cover?art=https%3A%2F%2Fexample.com%2Fradio.webp';

function renderWith(player: MprisPlayer) {
	return render(NowPlayingCover, { host: 'raspodio.local', port: 8018, player });
}

beforeEach(() => {
	// jsdom has no modal dialog support
	HTMLDialogElement.prototype.showModal = function () {
		this.setAttribute('open', '');
	};
	HTMLDialogElement.prototype.close = function () {
		this.removeAttribute('open');
	};
});

describe('NowPlayingCover', () => {
	test('loads the cover through odio-api', () => {
		const { container } = renderWith(mpd);
		expect(container.querySelector('img.np-cover')).toHaveAttribute('src', coverSrc);
	});

	test('dims the cover while paused', () => {
		const { container } = renderWith({ ...mpd, playback_status: 'Paused' });
		expect(container.querySelector('img.np-cover')).toHaveClass('paused');
	});

	test('falls back to a placeholder without artwork', () => {
		const { container } = renderWith({ ...mpd, metadata: { 'xesam:title': 'x' } });
		expect(container.querySelector('img')).not.toBeInTheDocument();
		expect(container.querySelector('.np-cover.placeholder')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Zoom cover' })).not.toBeInTheDocument();
	});

	test('falls back to a placeholder when the cover fails to load', async () => {
		const { container } = renderWith(mpd);
		await fireEvent.error(container.querySelector('img.np-cover')!);
		expect(container.querySelector('img')).not.toBeInTheDocument();
		expect(container.querySelector('.np-cover.placeholder')).toBeInTheDocument();
	});

	test('clicking the cover zooms it, clicking the zoom closes it', async () => {
		const { container } = renderWith(mpd);
		const dialog = container.querySelector('dialog.np-zoom')!;
		expect(dialog).not.toHaveAttribute('open');
		await fireEvent.click(screen.getByRole('button', { name: 'Zoom cover' }));
		expect(dialog).toHaveAttribute('open');
		expect(dialog.querySelector('img')).toHaveAttribute('src', coverSrc);
		expect(dialog.querySelector('img')).toHaveAttribute('alt', 'La Grosse Radio Reggae');
		await fireEvent.click(dialog);
		expect(dialog).not.toHaveAttribute('open');
	});
});
