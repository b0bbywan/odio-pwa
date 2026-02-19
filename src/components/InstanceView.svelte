<script lang="ts">
	import { appState } from '../lib/state.svelte';
	import { getInstanceUiUrl } from '../lib/api';

	const instance = $derived(appState.activeInstance);
	const uiUrl = $derived(instance ? getInstanceUiUrl(instance.host, instance.port) : '');

	const displayName = $derived(
		instance?.label ||
			instance?.serverInfo?.hostname ||
			(instance ? `${instance.host}:${instance.port}` : ''),
	);

	let showSwitcher = $state(false);

	function switchTo(id: string) {
		appState.openInstance(id);
		showSwitcher = false;
	}
</script>

{#if instance}
	<div class="instance-view">
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
								{#if other.id !== instance.id}
									<button onclick={() => switchTo(other.id)}>
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

		<iframe src={uiUrl} title="odio-api UI - {displayName}" class="instance-iframe" allow="autoplay; fullscreen"></iframe>
	</div>
{/if}
