<script lang="ts">
	import { untrack } from 'svelte';
	import { push, replace, router } from 'svelte-spa-router';
	import { appState } from '../lib/state.svelte';
	import { getInstanceUiUrl } from '../lib/api';
	import { displayName as nameOf, isConnectable } from '../lib/instance';
	import { goHome, showInFrame } from '../lib/nav';
	import type { PowerEvent } from '../lib/types';
	import InstanceTopBar from './InstanceTopBar.svelte';
	import PowerScreen from './PowerScreen.svelte';
	import SavePrompt from './SavePrompt.svelte';
	import ConnectionStatusScreen from './ConnectionStatusScreen.svelte';
	import UpdatePrompt from './UpdatePrompt.svelte';

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
	// user gets a real view instead of a blank page. Replaced, not pushed, so
	// back does not land on the bad URL and bounce again.
	$effect(() => {
		if (host && !Number.isFinite(port)) replace('/');
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
	const displayName = $derived(instance ? nameOf(instance) : '');

	let powerEvent = $state<PowerEvent | null>(null);
	let serverWentOffline = $state(false);
	let waiting = $state(false); // user chose to wait during poweroff
	let iframeKey = $state(0);
	let iframe = $state<HTMLIFrameElement>();
	// Instance whose iframe has been on screen. While its server is
	// reconnecting (odio-api restart, update) the iframe stays mounted, so the
	// page the user navigated to (myMPD, admin) survives. Past the give-up
	// delay the power screen takes over as before. Keyed by id: an instance
	// opened while already reconnecting has no page to keep.
	let uiShownFor = $state<string | null>(null);
	// odio-api version the iframe was loaded with. A kept iframe can outlive
	// an update: when the server comes back with another version, offer a
	// reload rather than forcing one (it would lose the user's page).
	let frameVersion = $state<string | undefined>();
	let updatedTo = $state<string | null>(null);

	function handlePowerAction(action: PowerEvent) {
		powerEvent = action;
	}

	// Called by the connection layer after retries are exhausted. For an
	// instance we already reached, treat it as a poweroff so the user can wait.
	// For a host we never connected to (e.g. a typo'd deep link), the offline
	// status screen is more honest than "Server is shutting down". Once the
	// user chose to wait, keep trying however long the server takes (a
	// poweroff waits for someone to switch it back on).
	function handleGiveUp() {
		if (waiting && connectedId !== null) appState.retryOne(connectedId);
		else if (instance?.connectedAt) powerEvent = 'poweroff';
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
		frameVersion = undefined;
		updatedTo = null;
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
			const status = instance?.status;
			if (status === 'reconnecting' || status === 'offline' || status === 'probing') {
				serverWentOffline = true;
			} else if (instance?.status === 'online' && serverWentOffline && (powerEvent === 'reboot' || waiting)) {
				serverWentOffline = false;
				waiting = false;
				powerEvent = null;
				reloadFrame();
			}
		}
	});

	// This instance's UI has been on screen, and may still be: kept while
	// reconnecting, or behind the power screen.
	const uiShown = $derived(!!instance && uiShownFor === instance.id);

	// The server is coming back and this view shows its UI: keep the iframe up.
	const reconnecting = $derived(instance?.status === 'reconnecting' && uiShown);

	// The iframe is mounted: no power event, and the UI is reachable or was
	// shown before the connection dropped.
	const frameMounted = $derived(
		powerEvent === null && !!instance && (isConnectable(instance.status) || reconnecting),
	);

	$effect(() => {
		if (frameMounted && instance) uiShownFor = instance.id;
	});

	// Trap browser back/forward while a transient instance's UI is open so the
	// user gets the same Save prompt as the in-app back button. We push a
	// sentinel entry; popstate then re-arms it and surfaces the dialog instead
	// of letting the navigation through. Keyed on the UI having been shown,
	// not on the iframe being mounted: a power event must neither drop the
	// guard nor push another sentinel when it ends.
	$effect(() => {
		if (!instance?.transient) return;
		if (!uiShown) return;
		history.pushState({ ...history.state, odioGuard: true }, '');
		function onPopState() {
			history.pushState({ ...history.state, odioGuard: true }, '');
			appState.savePromptVisible = true;
		}
		window.addEventListener('popstate', onPopState);
		return () => window.removeEventListener('popstate', onPopState);
	});

	// The iframe is on screen and live: no power screen, no reconnection.
	const showingUi = $derived(frameMounted && !reconnecting);

	// The first version seen with the UI live is the one it was loaded with;
	// a different one later means odio-api was updated under the iframe.
	$effect(() => {
		const version = instance?.serverInfo?.api_version;
		if (!showingUi || instance?.status !== 'online' || !version) return;
		untrack(() => {
			if (frameVersion === undefined) frameVersion = version;
			else if (version !== frameVersion) updatedTo = version;
		});
	});

	// A fresh iframe on the UI home, loaded with the current version. Set it
	// here: the version effect does not re-run on a reload, so leaving it
	// unset would take the next update's version as the reference.
	function reloadFrame() {
		iframeKey++;
		frameVersion = instance?.serverInfo?.api_version;
		updatedTo = null;
	}

	// Keep the current page; the new version becomes the reference so the
	// next blip does not ask again.
	function closeUpdatePrompt() {
		if (updatedTo) frameVersion = updatedTo;
		updatedTo = null;
	}

	function startWaiting() {
		waiting = true;
		// Restart retries - give-up may have stopped them (common on mobile after backgrounding)
		if (connectedId !== null) appState.retryOne(connectedId);
	}

	function dismiss() {
		powerEvent = null;
		waiting = false;
		goHome();
	}

	function switchTo(id: string) {
		powerEvent = null;
		appState.openInstance(id);
	}

	function showDashboard() {
		if (iframe) showInFrame(iframe, uiUrl);
	}

	// Leaving a transient instance asks to save it first. Only once its UI has
	// been shown - asking to save a host that never answered would be pointless.
	function leave(go: () => void) {
		if (instance?.transient && uiShown) {
			appState.savePromptVisible = true;
		} else {
			go();
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
			onhome={() => leave(goHome)}
			ondashboard={showingUi ? showDashboard : undefined}
			transient={!!instance.transient}
			onsave={saveTransient}
			{reconnecting}
		/>

		{#if powerEvent !== null}
			<PowerScreen event={powerEvent} {waiting} onstartwaiting={startWaiting} ondismiss={dismiss} />
		{:else if isConnectable(instance.status) || reconnecting}
			<!-- Keyed on the URL too: switching instance swaps the whole iframe, as
			     changing its src would add a history entry of its own. -->
			<div class="instance-frame">
				{#key `${uiUrl}#${iframeKey}`}
					<iframe bind:this={iframe} src={uiUrl} title="odio-api UI - {displayName}" class="instance-iframe" allow="autoplay; fullscreen"></iframe>
				{/key}
				<!-- Dims a UI that may be stale; clicks still go through, myMPD
				     and the admin app often keep working while odio-api restarts. -->
				{#if reconnecting}
					<div class="instance-veil" aria-hidden="true"></div>
				{/if}
			</div>
		{:else}
			<ConnectionStatusScreen
				status={instance.status}
				{displayName}
				host={instance.host}
				port={instance.port}
				onback={goHome}
			/>
		{/if}

		{#if updatedTo && showingUi}
			<UpdatePrompt version={updatedTo} onreload={reloadFrame} onclose={closeUpdatePrompt} />
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
