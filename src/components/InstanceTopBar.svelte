<script lang="ts">
	import { appState } from '../lib/state.svelte';
	import { goHome } from '../lib/nav';
	import { displayName as nameOf } from '../lib/instance';

	let {
		displayName,
		currentId,
		onswitchto,
		onhome,
		ondashboard,
		transient = false,
		onsave,
	}: {
		displayName: string;
		currentId: string;
		onswitchto: (id: string) => void;
		onhome?: () => void;
		ondashboard?: () => void;
		transient?: boolean;
		onsave?: () => void;
	} = $props();

	// Native modal dialog: Escape and focus handling for free, and the iframe
	// below can't swallow the click that closes it.
	let switcher = $state<HTMLDialogElement>();
	let nameButton = $state<HTMLButtonElement>();

	// The dialog sits in the top layer, out of the bar's flow: line it up
	// under the name that opened it.
	function openSwitcher() {
		if (!switcher) return;
		switcher.style.left = `${nameButton?.getBoundingClientRect().left ?? 8}px`;
		switcher.showModal();
	}
</script>

<nav class="top-bar">
	<button class="btn-icon btn-home" onclick={onhome ?? goHome} title="Back to list">
		<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
			<path d="M3 10.5 12 3l9 7.5" />
			<path d="M5 9v12h5v-6h4v6h5V9" />
		</svg>
	</button>
	{#if ondashboard}
		<button class="btn-icon btn-dashboard" onclick={ondashboard} title="Node dashboard">
			<img src="/logo.png" alt="" width="24" height="24" />
		</button>
	{/if}
	<span class="top-bar-sep" aria-hidden="true"></span>

	{#if appState.connectableInstances.length > 1}
		<button
			class="btn-switch"
			bind:this={nameButton}
			onclick={openSwitcher}
			title="Switch instance"
			aria-haspopup="dialog"
		>
			<span class="current-name">{displayName}</span>
			<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
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
	{:else}
		<span class="current-name">{displayName}</span>
	{/if}

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
</nav>
