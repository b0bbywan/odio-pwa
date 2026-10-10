<script lang="ts">
	import type { MprisPlayer } from '../lib/types';
	import { currentPosition, formatTime, trackLength } from '../lib/players';

	let { player }: { player: MprisPlayer } = $props();

	const playing = $derived(player.playback_status === 'Playing');
	const length = $derived(trackLength(player));
	// Same rule as odio-api's UI. Streams have no length, and a player that
	// can't seek reports no usable position (e.g. a Snapcast client relaying
	// someone else's track: a length, but a position stuck at zero).
	const tracked = $derived(length !== undefined && !!player.capabilities?.can_seek);

	// Re-render every second while a tracked position is playing; the
	// position itself is extrapolated, not polled.
	let now = $state(Date.now());
	$effect(() => {
		if (!playing || !tracked) return;
		now = Date.now();
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});
	const position = $derived(currentPosition(player, now));
</script>

{#if tracked && length !== undefined}
	<div class="np-progress">
		<span>{formatTime(position)}</span>
		<div class="np-bar" aria-hidden="true">
			<div class="np-bar-fill" class:paused={!playing} style:width="{(position / length) * 100}%"></div>
		</div>
		<span>{formatTime(length)}</span>
	</div>
{/if}
