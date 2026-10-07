<script lang="ts">
	import { tick } from 'svelte';
	import { sendPowerAction } from '../lib/api';

	let { host, port, name }: { host: string; port: number; name: string } = $props();

	let confirming = $state(false);
	let pending = $state(false);
	let failed = $state(false);
	// Request accepted: stays disabled until the card drops this button
	// (server offline), which also resets it for the next time.
	let sent = $state(false);
	// Keyboard users get focus moved into the confirmation and back; mouse
	// users keep it where it is, without a stray focus ring.
	let byKeyboard = false;
	let root: HTMLElement | undefined = $state();
	let iconButton: HTMLButtonElement | undefined = $state();

	// Start on Cancel, not on the destructive button: Enter must not power off.
	function focusOnMount(node: HTMLElement) {
		if (byKeyboard) node.focus();
	}

	function open(e: MouseEvent) {
		// The icon is gone by the time the click reaches window: keep it from
		// counting as an outside click.
		e.stopPropagation();
		byKeyboard = e.detail === 0;
		failed = false;
		confirming = true;
	}

	async function cancel() {
		if (pending) return;
		confirming = false;
		if (!byKeyboard) return;
		await tick();
		iconButton?.focus();
	}

	async function confirm() {
		pending = true;
		failed = false;
		try {
			await sendPowerAction(host, port, 'power_off');
			sent = true;
			confirming = false;
		} catch {
			failed = true;
		} finally {
			pending = false;
		}
	}

	function onWindowClick(e: MouseEvent) {
		if (confirming && root && !root.contains(e.target as Node)) cancel();
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (confirming && e.key === 'Escape') cancel();
	}
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

<div class="power-off" bind:this={root}>
	{#if confirming}
		<div class="power-confirm" role="alertdialog" aria-label="Power off {name}?">
			<button class="btn-icon" onclick={cancel} disabled={pending} title="Cancel" use:focusOnMount>
				<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
			<button
				class="btn-danger"
				onclick={confirm}
				disabled={pending}
				title={failed ? 'Power off failed' : undefined}
			>
				{failed ? 'Retry' : 'Power off'}
			</button>
		</div>
	{:else}
		<button
			class="btn-icon danger"
			bind:this={iconButton}
			onclick={open}
			disabled={sent}
			title={sent ? 'Powering off…' : 'Power off'}
			aria-haspopup="dialog"
		>
			<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 2v10" />
				<path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
			</svg>
		</button>
	{/if}
</div>
