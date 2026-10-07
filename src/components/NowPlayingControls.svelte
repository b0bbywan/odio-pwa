<script lang="ts">
	import type { MprisPlayer, PlayerAction } from '../lib/types';
	import { sendPlayerAction } from '../lib/api';

	let { host, port, player }: { host: string; port: number; player: MprisPlayer } = $props();

	const playing = $derived(player.playback_status === 'Playing');
	const caps = $derived(player.capabilities);
	const canPlayPause = $derived(!!caps?.can_control && (playing ? caps.can_pause : caps.can_play));

	function send(action: PlayerAction) {
		// The resulting state comes back as a player.updated event.
		sendPlayerAction(host, port, player.bus_name, action).catch(() => {});
	}
</script>

<div class="np-controls">
	<button
		class="np-btn"
		title="Previous"
		aria-label="Previous"
		disabled={!caps?.can_control || !caps.can_go_previous}
		onclick={() => send('previous')}
	>
		<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
			<polygon points="19 20 9 12 19 4 19 20" />
			<line x1="5" y1="19" x2="5" y2="5" />
		</svg>
	</button>
	<button
		class="np-btn primary"
		class:paused={!playing}
		title={playing ? 'Pause' : 'Play'}
		aria-label={playing ? 'Pause' : 'Play'}
		disabled={!canPlayPause}
		onclick={() => send('play_pause')}
	>
		{#if playing}
			<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
				<rect x="6" y="4" width="4" height="16" rx="1" />
				<rect x="14" y="4" width="4" height="16" rx="1" />
			</svg>
		{:else}
			<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
				<polygon points="7 4 20 12 7 20 7 4" />
			</svg>
		{/if}
	</button>
	<button
		class="np-btn"
		title="Next"
		aria-label="Next"
		disabled={!caps?.can_control || !caps.can_go_next}
		onclick={() => send('next')}
	>
		<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
			<polygon points="5 4 15 12 5 20 5 4" />
			<line x1="19" y1="5" x2="19" y2="19" />
		</svg>
	</button>
</div>
