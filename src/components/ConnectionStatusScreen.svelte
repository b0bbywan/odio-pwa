<script lang="ts">
	let {
		status,
		displayName,
		host,
		port,
		onback,
	}: {
		status: 'probing' | 'unknown' | 'offline' | 'blocked';
		displayName: string;
		host: string;
		port: number;
		onback: () => void;
	} = $props();

	const lanDocsHref = 'https://docs.odio.love/guides/pwa/#lan-access';
	const probing = $derived(status === 'probing' || status === 'unknown');
</script>

<div class="status-screen" role="status">
	{#if probing}
		<svg class="status-screen-icon spin" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
			<polyline points="23 4 23 10 17 10" />
			<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
		</svg>
		<h2 class="status-screen-title">Connecting to {displayName}</h2>
		<p class="status-screen-body">{host}:{port}</p>
		<div class="status-screen-actions">
			<button class="btn-secondary" onclick={onback}>Back to list</button>
		</div>
	{:else if status === 'offline'}
		<svg class="status-screen-icon" style="color: var(--danger)" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
			<circle cx="12" cy="12" r="10" />
			<line x1="12" y1="8" x2="12" y2="12" />
			<line x1="12" y1="16" x2="12.01" y2="16" />
		</svg>
		<h2 class="status-screen-title">Server unreachable</h2>
		<p class="status-screen-body">{host}:{port} did not respond.</p>
		<div class="status-screen-actions">
			<button class="btn-secondary" onclick={onback}>Back to list</button>
		</div>
	{:else if status === 'blocked'}
		<svg class="status-screen-icon" style="color: var(--warning)" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
			<circle cx="12" cy="12" r="10" />
			<line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
		</svg>
		<h2 class="status-screen-title">Browser blocked the request</h2>
		<p class="status-screen-body">
			HTTPS pages cannot reach {host}:{port} on plain HTTP. See
			<a href={lanDocsHref} target="_blank" rel="noopener noreferrer">mixed content</a>.
		</p>
		<div class="status-screen-actions">
			<button class="btn-secondary" onclick={onback}>Back to list</button>
		</div>
	{/if}
</div>
