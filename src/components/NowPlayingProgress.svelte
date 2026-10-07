<script lang="ts">
	import type { MprisPlayer } from '../lib/types';
	import { currentPosition, formatTime, trackLength } from '../lib/players';

	let { player }: { player: MprisPlayer } = $props();

	const playing = $derived(player.playback_status === 'Playing');
	const length = $derived(trackLength(player));

	// Re-render every second while a track with a known length is playing;
	// the position itself is extrapolated, not polled.
	let now = $state(Date.now());
	$effect(() => {
		if (!playing || length === undefined) return;
		now = Date.now();
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});
	const position = $derived(currentPosition(player, now));
</script>

<!-- Streams have no length: nothing to show. -->
{#if length !== undefined}
	<div class="np-progress">
		<span>{formatTime(position)}</span>
		<div class="np-bar" aria-hidden="true">
			<div class="np-bar-fill" class:paused={!playing} style:width="{(position / length) * 100}%"></div>
		</div>
		<span>{formatTime(length)}</span>
	</div>
{/if}
