<script lang="ts">
	import { onMount } from 'svelte';
	import { appState } from '../lib/state.svelte';
	import { getInstanceUiUrl } from '../lib/api';
	import type { PowerEvent } from '../lib/types';

	const BYE_TIMEOUT_MS = 30_000;

	const instance = $derived(appState.activeInstance);
	const uiUrl = $derived(instance ? getInstanceUiUrl(instance.host, instance.port) : '');
	const displayName = $derived(
		instance?.label ||
			instance?.serverInfo?.hostname ||
			(instance ? `${instance.host}:${instance.port}` : ''),
	);

	let showSwitcher = $state(false);
	let powerModal = $state<PowerEvent | null>(null);
	let serverBack = $state(false);
	let iframeKey = $state(0);
	let byeTimerId: ReturnType<typeof setTimeout> | null = null;
	let currentSSEId: string | null = null; // plain JS — must not be $state

	// When the server reconnects while the modal is open, switch to "back online" message
	$effect(() => {
		if (powerModal !== null && instance?.status === 'online') {
			clearBye();
			serverBack = true;
		}
	});

	function clearBye() {
		if (byeTimerId !== null) {
			clearTimeout(byeTimerId);
			byeTimerId = null;
		}
	}

	function handlePowerAction(action: PowerEvent) {
		clearBye();
		powerModal = action;
	}

	function handleBye() {
		byeTimerId = setTimeout(() => {
			byeTimerId = null;
			powerModal = 'poweroff';
		}, BYE_TIMEOUT_MS);
	}

	function dismissModal() {
		powerModal = null;
		clearBye();
		appState.goToList();
	}

	function attachSSE(id: string) {
		if (currentSSEId !== null) appState.disconnectOne(currentSSEId);
		currentSSEId = id;
		serverBack = false;
		appState.connectOne(id, { onPowerAction: handlePowerAction, onBye: handleBye });
	}

	function detachSSE() {
		clearBye();
		if (currentSSEId !== null) {
			appState.disconnectOne(currentSSEId);
			currentSSEId = null;
		}
	}

	onMount(() => {
		if (instance?.id) attachSSE(instance.id);
		return () => detachSSE();
	});

	function switchTo(id: string) {
		powerModal = null;
		clearBye();
		attachSSE(id);
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

		{#key iframeKey}
			<iframe src={uiUrl} title="odio-api UI - {displayName}" class="instance-iframe" allow="autoplay; fullscreen"></iframe>
		{/key}

		{#if powerModal !== null}
			<div class="power-modal-backdrop">
				<div class="power-modal" role="alertdialog" aria-modal="true">
					{#if serverBack}
						<div class="power-modal-icon" style="color: var(--accent)">
							<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5">
								<polyline points="20 6 9 17 4 12" />
							</svg>
						</div>
						<h2 class="power-modal-title">Server is back online</h2>
						<div class="power-modal-actions">
							<button class="btn-primary" onclick={() => { powerModal = null; serverBack = false; iframeKey++; }}>Reconnect</button>
							<button class="btn-secondary" onclick={dismissModal}>Back to list</button>
						</div>
					{:else}
						<div class="power-modal-icon">
							{#if powerModal === 'poweroff'}
								<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5">
									<path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
									<line x1="12" y1="2" x2="12" y2="12" />
								</svg>
							{:else}
								<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5">
									<polyline points="23 4 23 10 17 10" />
									<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
								</svg>
							{/if}
						</div>
						<h2 class="power-modal-title">
							{powerModal === 'poweroff' ? 'Server is shutting down' : 'Server is rebooting'}
						</h2>
						<p class="power-modal-body">
							{powerModal === 'poweroff' ? 'The server has powered off.' : 'The server is rebooting.'}
						</p>
						<button class="btn-primary" onclick={dismissModal}>OK</button>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}
