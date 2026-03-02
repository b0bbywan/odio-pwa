<script lang="ts">
	import type { PowerEvent } from '../lib/types';

	let {
		event,
		waiting,
		onstartwaiting,
		ondismiss,
	}: {
		event: PowerEvent;
		waiting: boolean;
		onstartwaiting: () => void;
		ondismiss: () => void;
	} = $props();
</script>

<div class="power-screen" role="status">
	{#if event === 'reboot' || waiting}
		<svg class="power-screen-icon spin" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
			<polyline points="23 4 23 10 17 10" />
			<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
		</svg>
		<h2 class="power-screen-title">{event === 'reboot' ? 'Server is rebooting' : 'Server is shutting down'}</h2>
		<p class="power-screen-body">Waiting for comeback&hellip;</p>
	{:else}
		<svg class="power-screen-icon" style="color: var(--warning)" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
			<path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
			<line x1="12" y1="2" x2="12" y2="12" />
		</svg>
		<h2 class="power-screen-title">Server is shutting down</h2>
		<p class="power-screen-body">Do you want to wait for it to come back?</p>
		<div class="power-screen-actions">
			<button class="btn-primary" onclick={onstartwaiting}>Wait</button>
			<button class="btn-secondary" onclick={ondismiss}>Back to list</button>
		</div>
	{/if}
</div>
