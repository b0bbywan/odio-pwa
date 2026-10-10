<script lang="ts">
	import { onDestroy } from 'svelte';
	import { appState } from '../lib/state.svelte';
	import { Scanner } from '../lib/scanner.svelte';
	import ScanBlocked from './ScanBlocked.svelte';
	import ScanForm from './ScanForm.svelte';
	import ScanProgress from './ScanProgress.svelte';
	import ScanResults from './ScanResults.svelte';

	let { onclose }: { onclose: () => void } = $props();

	const scanner = new Scanner();
	// Back on the form after a scan: the target is what's left to change.
	let editing = $state(false);

	const addable = $derived(
		scanner.results.filter((r) => !appState.findByHostPort(r.host, scanner.port)),
	);
	const title = $derived(
		scanner.results.length
			? `${plural(scanner.results.length, 'instance')} found`
			: scanner.blocked
				? `${scanner.blocked === 1 ? '1 host answers' : `${scanner.blocked} hosts answer`}, but not to this site`
				: scanner.scope
					? 'No odio-api found'
					: 'No active network found',
	);

	function plural(count: number, word: string): string {
		return `${count} ${word}${count === 1 ? '' : 's'}`;
	}

	function edit() {
		editing = true;
		scanner.edit();
	}

	function addAll() {
		for (const result of addable) appState.addInstance(result.host, scanner.port);
	}

	function close() {
		scanner.abort();
		onclose();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	onDestroy(() => scanner.abort());
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="scan-backdrop" onclick={close}></div>
<div class="scan-modal" role="dialog" aria-modal="true" aria-labelledby="scan-title">
	<header class="scan-header">
		<h3 id="scan-title">Scan network</h3>
		<button class="btn-icon" onclick={close} title="Close" aria-label="Close">
			<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<line x1="6" y1="6" x2="18" y2="18" />
				<line x1="18" y1="6" x2="6" y2="18" />
			</svg>
		</button>
	</header>

	{#if scanner.phase === 'form'}
		<ScanForm {scanner} focus={editing} onscan={() => scanner.start(appState.instances)} oncancel={close} />
	{:else}
		{#if scanner.phase === 'running' || !scanner.scope}
			<ScanProgress {scanner} />
		{/if}

		{#if scanner.phase === 'done'}
			<div class="scan-summary" class:warn={!scanner.results.length}>
				<strong>{title}</strong>
				{#if !scanner.scope}
					<span>
						Enter your network by hand, for example 192.168.1.0/24. Networks in 10.x and 172.16–31.x are too
						large to search automatically.
					</span>
				{:else}
					<span>{plural(scanner.progress.done, 'host')} scanned on {scanner.scope}</span>
					{#if !scanner.results.length && !scanner.blocked}
						<span>Check that odio-api is running and listens on port {scanner.port}.</span>
					{/if}
				{/if}
			</div>
		{/if}

		{#if scanner.results.length}
			<ScanResults results={scanner.results} port={scanner.port} />
		{/if}

		{#if scanner.phase === 'done' && scanner.blocked}
			<ScanBlocked count={scanner.blocked} port={scanner.port} others={scanner.results.length > 0} />
		{/if}

		<div class="scan-actions">
			{#if scanner.phase === 'running'}
				<button class="btn-secondary" onclick={() => scanner.stop()}>Stop</button>
			{:else}
				{#if addable.length > 1}
					<button class="btn-primary" onclick={addAll}>Add all ({addable.length})</button>
				{/if}
				<button class={scanner.results.length ? 'btn-secondary' : 'btn-primary'} onclick={edit}>
					{scanner.scope ? 'Scan again' : 'Enter a network'}
				</button>
				<button class="btn-secondary" onclick={close}>Close</button>
			{/if}
		</div>
	{/if}
</div>
