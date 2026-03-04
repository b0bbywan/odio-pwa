<script lang="ts">
	import { onMount } from 'svelte';
	import { appState } from '../lib/state.svelte';
	import { getInstanceUiUrl } from '../lib/api';
	import type { PowerEvent } from '../lib/types';
	import InstanceTopBar from './InstanceTopBar.svelte';
	import PowerScreen from './PowerScreen.svelte';

	const instance = $derived(appState.activeInstance);
	const uiUrl = $derived(instance ? getInstanceUiUrl(instance.host, instance.port) : '');
	const displayName = $derived(
		instance?.label ||
			instance?.serverInfo?.hostname ||
			(instance ? `${instance.host}:${instance.port}` : ''),
	);

	let powerEvent = $state<PowerEvent | null>(null);
	let serverWentOffline = $state(false);
	let waiting = $state(false); // user chose to wait during poweroff
	let iframeKey = $state(0);
	let currentSSEId: string | null = null; // plain JS — must not be $state

	// Two-phase detection — reboot always auto-reconnects, poweroff only if user chose to wait.
	$effect(() => {
		if (powerEvent !== null) {
			if (instance?.status === 'offline' || instance?.status === 'probing') {
				serverWentOffline = true;
			} else if (instance?.status === 'online' && serverWentOffline && (powerEvent === 'reboot' || waiting)) {
				serverWentOffline = false;
				waiting = false;
				powerEvent = null;
				iframeKey++;
			}
		}
	});

	function handlePowerAction(action: PowerEvent) {
		powerEvent = action;
	}

	// Called by the connection layer after retries are exhausted — treat as poweroff.
	function handleGiveUp() {
		powerEvent = 'poweroff';
	}

	function startWaiting() {
		waiting = true;
		// Restart retries — give-up may have stopped them (common on mobile after backgrounding)
		if (currentSSEId !== null) {
			appState.connectOne(currentSSEId, { onPowerAction: handlePowerAction, onGiveUp: handleGiveUp });
		}
	}

	function dismiss() {
		powerEvent = null;
		waiting = false;
		history.back();
		appState.goToList();
	}

	function attachSSE(id: string) {
		if (currentSSEId !== null) appState.disconnectOne(currentSSEId);
		currentSSEId = id;
		serverWentOffline = false;
		waiting = false;
		appState.connectOne(id, { onPowerAction: handlePowerAction, onGiveUp: handleGiveUp });
	}

	function detachSSE() {
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
		powerEvent = null;
		attachSSE(id);
		appState.openInstance(id);
	}
</script>

{#if instance}
	<div class="instance-view">
		<InstanceTopBar {displayName} currentId={instance.id} onswitchto={switchTo} />

		{#if powerEvent !== null}
			<PowerScreen event={powerEvent} {waiting} onstartwaiting={startWaiting} ondismiss={dismiss} />
		{:else}
			{#key iframeKey}
				<iframe src={uiUrl} title="odio-api UI - {displayName}" class="instance-iframe" allow="autoplay; fullscreen"></iframe>
			{/key}
		{/if}
	</div>
{/if}
