<script lang="ts">
	import type { MprisPlayer } from '../lib/types';
	import { activePlayers } from '../lib/players';
	import NowPlayingCover from './NowPlayingCover.svelte';
	import NowPlayingProgress from './NowPlayingProgress.svelte';

	let { host, port, players }: { host: string; port: number; players: MprisPlayer[] } = $props();

	let selected = $state<string | null>(null);
	const active = $derived(activePlayers(players));
	const player = $derived(active.find((p) => p.bus_name === selected) ?? active[0]);

	const meta = $derived(player?.metadata ?? {});
	const title = $derived(meta['xesam:title'] || player?.identity);
	const playing = $derived(player?.playback_status === 'Playing');
</script>

{#if player}
	<section class="now-playing" aria-label="Now playing">
		{#if active.length > 1}
			<div class="np-tabs" role="tablist" aria-label="Players">
				{#each active as p (p.bus_name)}
					<button
						class="np-tab"
						role="tab"
						title={p.identity}
						aria-selected={p.bus_name === player.bus_name}
						onclick={() => (selected = p.bus_name)}
					>
						{#if p.playback_status === 'Playing'}
							<span class="np-dot"></span>
						{:else}
							<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" role="img" aria-label="Paused">
								<rect x="6" y="4" width="4" height="16" />
								<rect x="14" y="4" width="4" height="16" />
							</svg>
						{/if}
						<span class="np-label">{p.identity}</span>
					</button>
				{/each}
			</div>
		{:else}
			<div class="np-header">
				{#if playing}
					<span class="np-eq" aria-hidden="true"><span></span><span></span><span></span></span>
					<span class="np-label" title={player.identity}>{player.identity}</span>
				{:else}
					<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true">
						<rect x="6" y="4" width="4" height="16" />
						<rect x="14" y="4" width="4" height="16" />
					</svg>
					<span class="np-label" title={player.identity}>{player.identity} · Paused</span>
				{/if}
			</div>
		{/if}

		<div class="np-body">
			<NowPlayingCover {host} {port} {player} />
			<div class="np-text">
				<div class="np-title" title={title}>{title}</div>
				{#if meta['xesam:artist']}
					<div class="np-artist" title={meta['xesam:artist']}>{meta['xesam:artist']}</div>
				{/if}
				{#if meta['xesam:album']}
					<div class="np-album" title={meta['xesam:album']}>{meta['xesam:album']}</div>
				{/if}
			</div>
		</div>

		<NowPlayingProgress {player} />
	</section>
{/if}
