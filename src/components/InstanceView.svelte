<script lang="ts">
	import { untrack } from 'svelte';
	import { push, router } from 'svelte-spa-router';
	import { appState } from '../lib/state.svelte';
	import { getInstanceUiUrl } from '../lib/api';
	import type { PowerEvent } from '../lib/types';
	import InstanceTopBar from './InstanceTopBar.svelte';
	import PowerScreen from './PowerScreen.svelte';
	import SavePrompt from './SavePrompt.svelte';
	import ConnectionStatusScreen from './ConnectionStatusScreen.svelte';

	const DEFAULT_PORT = 8018;

	let { params }: { params: { host: string; port?: string | null } } = $props();

	const host = $derived(decodeURIComponent(params.host || '').trim());
	const port = $derived.by(() => {
		if (!params.port) return DEFAULT_PORT;
		const n = parseInt(params.port, 10);
		return Number.isFinite(n) && n >= 1 && n <= 65535 ? n : NaN;
	});
	const labelFromUrl = $derived(
		new URLSearchParams(router.querystring ?? '').get('label')?.trim() || undefined,
	);

	// Invalid port (non-numeric or out of range) - bounce to the list so the
	// user gets a real view instead of a blank page.
	$effect(() => {
		if (host && !Number.isFinite(port)) push('/');
	});

	// Find or transiently add the instance matching the route params. If we
	// created it and the user neither saved nor discarded, the cleanup removes
	// it so unsaved hosts don't pile up across route changes. The lookup and
	// the create are untracked so this effect only re-runs when host/port
	// change, not on every status update of any instance in the array.
	$effect(() => {
		if (!host || !Number.isFinite(port)) return;
		const createdId = untrack(() => {
			if (appState.findByHostPort(host, port)) return null;
			return appState.addInstance(host, port, labelFromUrl, { transient: true });
		});
		return () => {
			if (!createdId) return;
			if (appState.findById(createdId)?.transient) {
				appState.removeInstance(createdId);
			}
		};
	});

	const instance = $derived(
		host && Number.isFinite(port) ? appState.findByHostPort(host, port) : undefined,
	);
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

	function handlePowerAction(action: PowerEvent) {
		powerEvent = action;
	}

	// Called by the connection layer after retries are exhausted. For an
	// instance we already reached, treat it as a poweroff so the user can wait.
	// For a host we never connected to (e.g. a typo'd deep link), the offline
	// status screen is more honest than "Server is shutting down".
	function handleGiveUp() {
		if (instance?.connectedAt) powerEvent = 'poweroff';
	}

	const powerCallbacks = { onPowerAction: handlePowerAction, onGiveUp: handleGiveUp };

	// Foreground connection: attach power callbacks while we're on this view,
	// hand back to the background pool (no callbacks) on unmount or instance
	// switch. The connection layer skips retries on cors so a missing-headers
	// server stays idle without spamming probes.
	let connectedId: string | null = null;
	$effect(() => {
		const id = instance?.id;
		if (!id || id === connectedId) return;
		connectedId = id;
		serverWentOffline = false;
		waiting = false;
		// A leftover save prompt from a previous instance must not surface here.
		appState.savePromptVisible = false;
		appState.connectOne(id, powerCallbacks);
		return () => {
			if (connectedId === id) {
				connectedId = null;
				appState.connectOne(id);
			}
		};
	});

	// Two-phase detection - reboot always auto-reconnects, poweroff only if user chose to wait.
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

	// Trap browser back/forward while a connectable transient instance is open
	// so the user gets the same Save prompt as the in-app back button. We push
	// a sentinel entry; popstate then re-arms it and surfaces the dialog
	// instead of letting the navigation through.
	$effect(() => {
		if (!instance?.transient) return;
		if (instance.status !== 'online' && instance.status !== 'cors') return;
		history.pushState({ odioGuard: true }, '');
		function onPopState() {
			history.pushState({ odioGuard: true }, '');
			appState.savePromptVisible = true;
		}
		window.addEventListener('popstate', onPopState);
		return () => window.removeEventListener('popstate', onPopState);
	});

	function startWaiting() {
		waiting = true;
		// Restart retries - give-up may have stopped them (common on mobile after backgrounding)
		if (connectedId !== null) appState.connectOne(connectedId, powerCallbacks);
	}

	function dismiss() {
		powerEvent = null;
		waiting = false;
		push('/');
	}

	function switchTo(id: string) {
		powerEvent = null;
		appState.openInstance(id);
	}

	function handleBack() {
		// Only prompt to save when the instance is actually connectable - asking
		// the user to save an unreachable host would be pointless.
		if (
			instance?.transient &&
			(instance.status === 'online' || instance.status === 'cors')
		) {
			appState.savePromptVisible = true;
		} else {
			push('/');
		}
	}

	function leaveToList() {
		appState.savePromptVisible = false;
		push('/');
	}

	function saveTransient() {
		if (!instance) return;
		appState.persistInstance(instance.id);
		appState.savePromptVisible = false;
	}

	function savePromptSave() {
		if (instance) appState.persistInstance(instance.id);
		leaveToList();
	}

	function savePromptDiscard() {
		if (instance) appState.removeInstance(instance.id);
		leaveToList();
	}

	function savePromptCancel() {
		appState.savePromptVisible = false;
	}
</script>

{#if instance}
	<div class="instance-view">
		<InstanceTopBar
			{displayName}
			currentId={instance.id}
			onswitchto={switchTo}
			onback={handleBack}
			transient={!!instance.transient}
			onsave={saveTransient}
		/>

		{#if powerEvent !== null}
			<PowerScreen event={powerEvent} {waiting} onstartwaiting={startWaiting} ondismiss={dismiss} />
		{:else if instance.status === 'online' || instance.status === 'cors'}
			{#key iframeKey}
				<iframe src={uiUrl} title="odio-api UI - {displayName}" class="instance-iframe" allow="autoplay; fullscreen"></iframe>
			{/key}
		{:else}
			<ConnectionStatusScreen
				status={instance.status}
				{displayName}
				host={instance.host}
				port={instance.port}
				onback={handleBack}
			/>
		{/if}

		{#if appState.savePromptVisible && instance.transient}
			<SavePrompt
				{displayName}
				onsave={savePromptSave}
				ondiscard={savePromptDiscard}
				oncancel={savePromptCancel}
			/>
		{/if}
	</div>
{/if}
