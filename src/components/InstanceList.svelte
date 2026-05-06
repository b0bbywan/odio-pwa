<script lang="ts">
	import { onMount } from 'svelte';
	import { appState } from '../lib/state.svelte';
	import { fetchLatestRelease, type ReleaseInfo } from '../lib/github';
	import { detectUnsupportedDesktop } from '../lib/browser';
	import InstanceCard from './InstanceCard.svelte';
	import AddInstanceForm from './AddInstanceForm.svelte';

	let showAddForm = $state(false);
	let update = $state<ReleaseInfo | null>(null);
	let unsupported = $state<'firefox' | 'safari' | null>(null);

	const hostedPwa = location.hostname === 'pwa.odio.love';
	const unsupportedLabel = $derived(
		unsupported ? unsupported[0].toUpperCase() + unsupported.slice(1) : '',
	);
	const ctaDisabledTitle = $derived(
		unsupported ? `${unsupportedLabel} desktop blocks local-network connections from HTTPS sites.` : '',
	);
	const updateTooltip = $derived(
		update
			? hostedPwa
				? `v${update.version} available — this PWA updates itself automatically, click for release notes`
				: `v${update.version} available — click for release notes`
			: '',
	);

	onMount(() => {
		fetchLatestRelease(__APP_VERSION__).then((latest) => {
			if (latest) update = latest;
		});
		unsupported = detectUnsupportedDesktop();
	});
</script>

<main class="instance-list">
	<header class="list-header">
		<div class="brand">
			<img src="/logo.png" alt="" class="brand-logo" width="44" height="44" />
			<h1>odio</h1>
		</div>
		<button class="btn-icon" onclick={() => appState.probeAll()} title="Refresh all">
			<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="23 4 23 10 17 10" />
				<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
			</svg>
		</button>
	</header>

	{#if unsupported}
		<aside class="warning-banner" role="alert">
			<div class="warning-body">
				<strong>{unsupportedLabel} desktop blocks local-network connections from HTTPS sites.</strong>
				Use Chrome or Edge, or
				<a href="https://docs.odio.love/guides/pwa/#self-hosting" target="_blank" rel="noopener noreferrer">
					self-host this website
				</a>
				over HTTP on your network.
			</div>
		</aside>
	{/if}

	{#if appState.instances.length === 0 && !showAddForm && !unsupported}
		<div class="empty-state">
			<p>No instances configured.</p>
			<p>Add an odio-api instance to get started.</p>
		</div>
	{/if}

	<div class="card-grid">
		{#each appState.instances as instance (instance.id)}
			<InstanceCard {instance} />
		{/each}
	</div>

	<section class="add-section">
		{#if showAddForm}
			<AddInstanceForm onclose={() => (showAddForm = false)} />
		{:else}
			<button
				class="btn-add"
				onclick={() => (showAddForm = true)}
				disabled={!!unsupported}
				title={ctaDisabledTitle}
			>
				+ Add Instance
			</button>
		{/if}
	</section>

	<footer class="app-footer">
		<a class="docs-link" href="https://docs.odio.love" target="_blank" rel="noopener noreferrer">
			docs.odio.love
		</a>
		<div class="version-row">
			<span class="app-version">v{__APP_VERSION__}</span>
			{#if update}
				<a
					class="update-badge"
					href={update.url}
					target="_blank"
					rel="noopener noreferrer"
					title={updateTooltip}
					aria-label={updateTooltip}
				>
					<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<line x1="12" y1="19" x2="12" y2="5" />
						<polyline points="5 12 12 5 19 12" />
					</svg>
				</a>
			{/if}
		</div>
	</footer>
</main>
