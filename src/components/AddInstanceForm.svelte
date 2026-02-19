<script lang="ts">
	import { untrack } from 'svelte';
	import type { OdioInstance } from '../lib/types';
	import { appState } from '../lib/state.svelte';

	let {
		editInstance,
		onclose,
	}: {
		editInstance?: OdioInstance;
		onclose: () => void;
	} = $props();

	let host = $state(untrack(() => editInstance?.host ?? ''));
	let port = $state(untrack(() => editInstance?.port ?? 8018));
	let label = $state(untrack(() => editInstance?.label ?? ''));

	function handleSubmit(e: Event) {
		e.preventDefault();
		const trimmedHost = host.trim();
		if (!trimmedHost) return;

		if (editInstance) {
			appState.updateInstance(editInstance.id, trimmedHost, port, label.trim() || undefined);
		} else {
			appState.addInstance(trimmedHost, port, label.trim() || undefined);
		}
		onclose();
	}
</script>

<form class="add-form" onsubmit={handleSubmit}>
	<h3>{editInstance ? 'Edit Instance' : 'Add Instance'}</h3>

	<label>
		<span>Host / IP</span>
		<input type="text" bind:value={host} placeholder="192.168.1.100" required />
	</label>

	<label>
		<span>Port</span>
		<input type="number" bind:value={port} min={1} max={65535} />
	</label>

	<label>
		<span>Label (optional)</span>
		<input type="text" bind:value={label} placeholder="Living Room" />
	</label>

	<div class="form-actions">
		<button type="submit" class="btn-primary">{editInstance ? 'Save' : 'Add'}</button>
		<button type="button" class="btn-secondary" onclick={onclose}>Cancel</button>
	</div>
</form>
