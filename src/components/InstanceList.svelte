<script lang="ts">
	import { appState } from '../lib/state.svelte';
	import InstanceCard from './InstanceCard.svelte';
	import AddInstanceForm from './AddInstanceForm.svelte';

	let showAddForm = $state(false);

	$effect(() => {
		appState.probeAll();
	});
</script>

<main class="instance-list">
	<header class="list-header">
		<h1>odio</h1>
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
</main>
