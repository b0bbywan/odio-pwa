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
	let currentSSEId: string | null = null; // plain JS - must not be $state

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

	// Status can flip to cors after the first probe (e.g. a transient instance
	// opened via URL). Drop the keepalive so the give-up timer can't trigger a
	// misleading poweroff overlay.
	$effect(() => {
		if (instance?.status === 'cors' && currentSSEId !== null) {
			detachSSE();
		}
	});

	// Attach/detach SSE in sync with the resolved instance. Re-runs when the
	// route switches to a different host/port (e.g. via the TopBar switcher).
	$effect(() => {
		const id = instance?.id;
		if (!id) return;
		if (id === currentSSEId) return;
		attachSSE(id);
		return () => {
			if (currentSSEId === id) detachSSE();
		};
	});

	// Trap browser back/forward while a transient instance is open so the user
	// gets the same Save prompt as the in-app back button. We push a sentinel
	// entry; popstate then re-arms it and surfaces the dialog instead of
	// letting the navigation through. On teardown (Save / Don't save / unmount)
	// we pop the sentinel so the user doesn't have to back through a phantom
	// history entry to leave.
	$effect(() => {
		if (!instance?.transient) return;
		history.pushState({ odioGuard: true }, '');
		function onPopState() {
			history.pushState({ odioGuard: true }, '');
			appState.savePromptVisible = true;
		}
		window.addEventListener('popstate', onPopState);
		return () => {
			window.removeEventListener('popstate', onPopState);
			if (history.state?.odioGuard) history.back();
		};
	});

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

	function startWaiting() {
		waiting = true;
		// Restart retries - give-up may have stopped them (common on mobile after backgrounding)
		if (currentSSEId !== null) {
			appState.connectOne(currentSSEId, { onPowerAction: handlePowerAction, onGiveUp: handleGiveUp });
		}
	}

	function dismiss() {
		powerEvent = null;
		waiting = false;
		push('/');
	}

	function attachSSE(id: string) {
		if (currentSSEId !== null) appState.disconnectOne(currentSSEId);
		currentSSEId = null;
		serverWentOffline = false;
		waiting = false;
		// CORS blocks the probe but not the iframe - skip the keepalive so the
		// give-up timer can't trigger a misleading poweroff overlay.
		if (appState.findById(id)?.status === 'cors') return;
		currentSSEId = id;
		appState.connectOne(id, { onPowerAction: handlePowerAction, onGiveUp: handleGiveUp });
	}

	function detachSSE() {
		if (currentSSEId !== null) {
			const id = currentSSEId;
			currentSSEId = null;
			// Hand the connection back to the background pool (no power callbacks)
			// so the list view still shows fresh status after we leave.
			appState.connectOne(id);
		}
	}

	onMount(() => {
		return () => detachSSE();
	});

	function switchTo(id: string) {
		powerEvent = null;
		appState.openInstance(id);
	}

	function handleBack() {
		if (instance?.transient) {
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
