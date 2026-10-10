<script lang="ts">
	let {
		count,
		port,
		others = false,
	}: {
		count: number;
		port: number;
		// Instances were found besides these hosts.
		others?: boolean;
	} = $props();

	let copied = $state(false);

	const one = $derived(count === 1);
	const text = $derived(
		others
			? `${count} other ${one ? 'host answers' : 'hosts answer'} on port ${port} but ${one ? "doesn't" : "don't"} allow this origin.`
			: `${one ? 'It listens' : 'They listen'} on port ${port} but ${one ? "doesn't" : "don't"} allow this origin.`,
	);

	async function copy() {
		await navigator.clipboard.writeText(location.origin);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="scan-blocked">
	<p>
		{#if others}
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<path d="M12 3 2 20h20L12 3z" />
				<line x1="12" y1="10" x2="12" y2="14" />
				<line x1="12" y1="17" x2="12" y2="17.01" />
			</svg>
		{/if}
		<span>{text} Add it to <code>api.cors.origins</code> on each node:</span>
	</p>
	<div class="scan-origin">
		<code>{location.origin}</code>
		<!-- The clipboard needs a secure context: not there on a PWA self-hosted over plain HTTP. -->
		{#if navigator.clipboard}
			<button class="btn-secondary" onclick={copy}>{copied ? 'Copied' : 'Copy'}</button>
		{/if}
	</div>
</div>
