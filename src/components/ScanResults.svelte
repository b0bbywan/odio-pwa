<script lang="ts">
	import { appState } from '../lib/state.svelte';
	import type { ScanResult } from '../lib/scan';

	let { results, port }: { results: ScanResult[]; port: number } = $props();
</script>

<ul class="scan-results">
	{#each results as result (result.host)}
		<li class="status-online">
			<span class="status-dot"></span>
			<div class="scan-result-info">
				<strong>{result.info.hostname}</strong>
				<span>{result.host} · {result.info.api_sw} {result.info.api_version}</span>
			</div>
			{#if appState.findByHostPort(result.host, port)}
				<svg class="scan-added" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="Already added">
					<title>Already added</title>
					<circle cx="12" cy="12" r="10" />
					<polyline points="7.5 12.5 10.5 15.5 16.5 9" />
				</svg>
			{:else}
				<button class="btn-primary" onclick={() => appState.addInstance(result.host, port)}>Add</button>
			{/if}
		</li>
	{/each}
</ul>
