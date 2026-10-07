import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import NowPlayingProgress from './NowPlayingProgress.svelte';
import { mpdPlayer } from '../test/fixtures';

const T0 = Date.parse('2026-10-07T20:00:00.000Z');

const track = mpdPlayer({
	position: 65_000_000, // 1:05
	position_updated_at: new Date(T0).toISOString(),
	metadata: { 'mpris:length': '200000000' }, // 3:20
});

afterEach(() => {
	vi.useRealTimers();
});

describe('NowPlayingProgress', () => {
	test('renders nothing for a stream without a length', () => {
		const { container } = render(NowPlayingProgress, {
			player: { ...track, metadata: {} },
		});
		expect(container.querySelector('.np-progress')).toBeNull();
	});

	test('advances every second while playing', async () => {
		vi.useFakeTimers({ now: T0 });
		render(NowPlayingProgress, { player: track });
		expect(screen.getByText('1:05')).toBeInTheDocument();
		expect(screen.getByText('3:20')).toBeInTheDocument();
		await vi.advanceTimersByTimeAsync(3_000);
		expect(screen.getByText('1:08')).toBeInTheDocument();
	});

	test('stays put while paused', async () => {
		vi.useFakeTimers({ now: T0 });
		render(NowPlayingProgress, { player: { ...track, playback_status: 'Paused' } });
		await vi.advanceTimersByTimeAsync(3_000);
		expect(screen.getByText('1:05')).toBeInTheDocument();
	});

	test('stops ticking once paused', async () => {
		vi.useFakeTimers({ now: T0 });
		const { rerender } = render(NowPlayingProgress, { player: track });
		await vi.advanceTimersByTimeAsync(2_000);
		// odio-api reports the position frozen at pause time.
		await rerender({
			player: {
				...track,
				playback_status: 'Paused',
				position: 67_000_000,
				position_updated_at: new Date(T0 + 2_000).toISOString(),
			},
		});
		await vi.advanceTimersByTimeAsync(5_000);
		expect(screen.getByText('1:07')).toBeInTheDocument();
		expect(vi.getTimerCount()).toBe(0);
	});
});
