<script lang="ts">
	import type { Writable } from 'svelte/store';

	let {
		offlineReady,
		needRefresh,
		updateServiceWorker,
	}: {
		offlineReady: Writable<boolean>;
		needRefresh: Writable<boolean>;
		updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
	} = $props();

	function close() {
		$offlineReady = false;
		$needRefresh = false;
	}
</script>

{#if $offlineReady || $needRefresh}
	<div class="pwa-toast" role="alert">
		{#if $offlineReady}
			<span>App ready to work offline</span>
		{:else}
			<span>New content available</span>
		{/if}
		{#if $needRefresh}
			<button class="btn-primary" onclick={() => updateServiceWorker(true)}>Reload</button>
		{/if}
		<button class="btn-secondary" onclick={close}>Close</button>
	</div>
{/if}
