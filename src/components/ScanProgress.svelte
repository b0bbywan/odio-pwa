<script lang="ts">
	import type { Scanner } from '../lib/scanner.svelte';

	let { scanner }: { scanner: Scanner } = $props();

	const active = $derived(scanner.phase === 'running');
</script>

<ul class="scan-steps">
	{#each scanner.steps as step}
		<li>
			<svg class="scan-step-done" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<polyline points="5 12 10 17 19 7" />
			</svg>
			<span>{step.label}</span>
			<span class="scan-step-detail">{step.detail}</span>
		</li>
	{/each}
	{#if active}
		<li>
			<svg class="scan-step-running spin" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
				<path d="M21 12a9 9 0 1 1-9-9" />
			</svg>
			<span>{scanner.running}</span>
		</li>
	{/if}
</ul>

{#if active}
	<div class="scan-progress">
		<progress value={scanner.progress.done} max={scanner.progress.total} aria-label={scanner.running}></progress>
		<span>{scanner.progress.done} / {scanner.progress.total}</span>
	</div>
{/if}
