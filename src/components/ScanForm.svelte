<script lang="ts">
	import { onMount } from 'svelte';
	import type { Scanner } from '../lib/scanner.svelte';

	let {
		scanner,
		focus = false,
		onscan,
		oncancel,
	}: {
		scanner: Scanner;
		// Put the cursor in the target field, e.g. when coming back to fix it.
		focus?: boolean;
		onscan: () => void;
		oncancel: () => void;
	} = $props();

	let targetInput: HTMLInputElement | undefined = $state();

	onMount(() => {
		if (focus) targetInput?.focus();
	});

	function handleSubmit(e: Event) {
		e.preventDefault();
		onscan();
	}
</script>

<form class="scan-form" onsubmit={handleSubmit}>
	<label>
		<span>Target (optional)</span>
		<input
			type="text"
			bind:value={scanner.target}
			bind:this={targetInput}
			placeholder="192.168.1.0/24"
			aria-invalid={!!scanner.error}
			aria-describedby="scan-target-help"
		/>
	</label>
	<p id="scan-target-help" class="scan-hint" class:error={!!scanner.error}>
		{scanner.error ||
			'An IP, or a network with its mask: 192.168.1.0/24 or 192.168.1.0/255.255.255.0. Leave empty to look for your network automatically.'}
	</p>

	<label>
		<span>Port</span>
		<input type="number" bind:value={scanner.port} min={1} max={65535} required />
	</label>

	<div class="scan-actions">
		<button type="submit" class="btn-primary">Scan</button>
		<button type="button" class="btn-secondary" onclick={oncancel}>Cancel</button>
	</div>
</form>
