<script lang="ts">
	import type { OdioInstance } from '../lib/types';
	import { appState } from '../lib/state.svelte';
	import AddInstanceForm from './AddInstanceForm.svelte';

	let { instance }: { instance: OdioInstance } = $props();
	let editing = $state(false);

	const displayName = $derived(
		instance.label || instance.serverInfo?.hostname || `${instance.host}:${instance.port}`,
	);

	const statusClass = $derived(
		instance.status === 'online'
			? 'status-online'
			: instance.status === 'offline'
				? 'status-offline'
				: instance.status === 'probing'
					? 'status-probing'
					: 'status-unknown',
	);
</script>

{#if editing}
	<AddInstanceForm editInstance={instance} onclose={() => (editing = false)} />
{:else}
	<article class="instance-card {statusClass}">
		<div class="card-header">
			<span class="status-dot"></span>
			<h3>{displayName}</h3>
		</div>

		{#if instance.serverInfo && instance.status === 'online'}
			<div class="card-info">
				<small
					>{instance.serverInfo.os_platform} &mdash; {instance.serverInfo.api_sw} {instance
						.serverInfo.api_version}</small
				>
			</div>
		{/if}

		<div class="card-address">
			<small>{instance.host}:{instance.port}</small>
		</div>

		<div class="card-actions">
			<button
				class="btn-primary"
				onclick={() => appState.openInstance(instance.id)}
				disabled={instance.status !== 'online'}
			>
				Connect
			</button>
			<button class="btn-icon" onclick={() => (editing = true)} title="Edit">
				<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
				</svg>
			</button>
			<button
				class="btn-icon danger"
				onclick={() => appState.removeInstance(instance.id)}
				title="Delete"
			>
				<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="3 6 5 6 21 6" />
					<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
				</svg>
			</button>
			<button class="btn-icon" onclick={() => appState.probeOne(instance.id)} title="Refresh">
				<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="23 4 23 10 17 10" />
					<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
				</svg>
			</button>
		</div>
	</article>
{/if}
