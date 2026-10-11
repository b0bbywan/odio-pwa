<script lang="ts">
	import { push } from 'svelte-spa-router';
	import { appState } from '../lib/state.svelte';
	import { displayName as nameOf } from '../lib/instance';

	let {
		displayName,
		currentId,
		onswitchto,
		onback,
		transient = false,
		onsave,
	}: {
		displayName: string;
		currentId: string;
		onswitchto: (id: string) => void;
		onback?: () => void;
		transient?: boolean;
		onsave?: () => void;
	} = $props();

	// Native modal dialog: Escape and focus handling for free, and the iframe
	// below can't swallow the click that closes it.
	let switcher = $state<HTMLDialogElement>();

	function handleBack() {
		if (onback) onback();
		else push('/');
	}
</script>

<nav class="top-bar">
	<button class="btn-icon" onclick={handleBack} title="Back to list">
		<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
			<polyline points="15 18 9 12 15 6" />
		</svg>
	</button>

	<span class="current-name">{displayName}</span>

	{#if transient && onsave}
		<button class="btn-save-instance" onclick={onsave} title="Save this instance">
			<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
				<polyline points="17 21 17 13 7 13 7 21" />
				<polyline points="7 3 7 8 15 8" />
			</svg>
			<span>Save</span>
		</button>
	{/if}

	{#if appState.connectableInstances.length > 1}
		<button
			class="btn-switch"
			onclick={() => switcher?.showModal()}
			title="Switch instance"
			aria-haspopup="dialog"
		>
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="6 9 12 15 18 9" />
			</svg>
		</button>
		<!-- Click anywhere closes: on an instance, after switching to it, or on the backdrop. -->
		<dialog
			class="switcher-dropdown"
			aria-label="Switch instance"
			bind:this={switcher}
			onclick={() => switcher?.close()}
		>
			{#each appState.connectableInstances as other (other.id)}
				{#if other.id !== currentId}
					<button onclick={() => onswitchto(other.id)}>{nameOf(other)}</button>
				{/if}
			{/each}
		</dialog>
	{/if}
</nav>
