<script lang="ts">
	import type { MprisPlayer } from '../lib/types';
	import { getPlayerCoverUrl } from '../lib/api';

	let { host, port, player }: { host: string; port: number; player: MprisPlayer } = $props();

	const meta = $derived(player.metadata ?? {});
	const artUrl = $derived(meta['mpris:artUrl']);
	const coverUrl = $derived(
		artUrl ? getPlayerCoverUrl(host, port, player.bus_name, artUrl) : undefined,
	);
	const alt = $derived(meta['xesam:album'] || meta['xesam:title'] || player.identity);
	let failedCover = $state<string | null>(null);
	// Native modal dialog: top layer, Escape and focus handling for free.
	let zoom = $state<HTMLDialogElement>();
</script>

{#if coverUrl && failedCover !== coverUrl}
	<button
		class="np-cover-btn"
		title="Zoom cover"
		aria-label="Zoom cover"
		onclick={() => zoom?.showModal()}
	>
		<img
			class="np-cover"
			class:paused={player.playback_status !== 'Playing'}
			src={coverUrl}
			alt=""
			onerror={() => (failedCover = coverUrl ?? null)}
		/>
	</button>
	<!-- Click anywhere (image or backdrop) closes; Escape is native. -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<dialog class="np-zoom" aria-label="Cover" bind:this={zoom} onclick={() => zoom?.close()}>
		<img src={coverUrl} {alt} />
	</dialog>
{:else}
	<div class="np-cover placeholder" aria-hidden="true">
		<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M9 18V5l12-2v13" />
			<circle cx="6" cy="18" r="3" />
			<circle cx="18" cy="16" r="3" />
		</svg>
	</div>
{/if}
