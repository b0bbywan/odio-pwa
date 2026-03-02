<script lang="ts">
	import { appState } from '../lib/state.svelte';

	let {
		displayName,
		currentId,
		onswitchto,
	}: {
		displayName: string;
		currentId: string;
		onswitchto: (id: string) => void;
	} = $props();

	let showSwitcher = $state(false);

	function handleSwitch(id: string) {
		showSwitcher = false;
		onswitchto(id);
	}
</script>

<nav class="top-bar">
	<button class="btn-icon" onclick={() => appState.goToList()} title="Back to list">
		<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
			<polyline points="15 18 9 12 15 6" />
		</svg>
	</button>

	<span class="current-name">{displayName}</span>

	{#if appState.onlineInstances.length > 1}
		<div class="switcher-wrapper">
			<button
				class="btn-switch"
				onclick={() => (showSwitcher = !showSwitcher)}
				title="Switch instance"
			>
				<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="6 9 12 15 18 9" />
				</svg>
			</button>
			{#if showSwitcher}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="switcher-backdrop" onclick={() => (showSwitcher = false)}></div>
				<div class="switcher-dropdown">
					{#each appState.onlineInstances as other (other.id)}
						{#if other.id !== currentId}
							<button onclick={() => handleSwitch(other.id)}>
								{other.label ||
									other.serverInfo?.hostname ||
									`${other.host}:${other.port}`}
							</button>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</nav>
