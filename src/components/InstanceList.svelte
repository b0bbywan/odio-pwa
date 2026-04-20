<script lang="ts">
	import { onMount } from 'svelte';
	import { appState } from '../lib/state.svelte';
	import { fetchLatestRelease, type ReleaseInfo } from '../lib/github';
	import InstanceCard from './InstanceCard.svelte';
	import AddInstanceForm from './AddInstanceForm.svelte';

	let showAddForm = $state(false);
	let update = $state<ReleaseInfo | null>(null);

	const hostedPwa = location.hostname === 'pwa.odio.love';
	const updateTooltip = $derived(
		update
			? hostedPwa
				? `v${update.version} available — this PWA updates itself automatically, click for release notes`
				: `v${update.version} available — click for release notes`
			: '',
	);

	onMount(() => {
		appState.connectAll();
		function onVisible() {
			if (document.visibilityState === 'visible') appState.probeAll();
		}
		document.addEventListener('visibilitychange', onVisible);

		fetchLatestRelease(__APP_VERSION__).then((latest) => {
			if (latest) update = latest;
		});

		return () => {
			appState.disconnectAll();
			document.removeEventListener('visibilitychange', onVisible);
		};
	});
</script>

<main class="instance-list">
	<header class="list-header">
		<h1>Odio</h1>
		<button class="btn-icon" onclick={() => appState.probeAll()} title="Refresh all">
			<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="23 4 23 10 17 10" />
				<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
			</svg>
		</button>
	</header>

	{#if appState.instances.length === 0 && !showAddForm}
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
			<button class="btn-add" onclick={() => (showAddForm = true)}> + Add Instance </button>
		{/if}
	</section>

	<footer class="app-footer">
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
	</footer>
</main>
