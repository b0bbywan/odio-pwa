<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	let {
		class: className = '',
		labelledby,
		onclose,
		children,
	}: {
		class?: string;
		// id of the heading naming the dialog
		labelledby: string;
		// Closed, whichever way: close(), Escape or the backdrop.
		onclose: () => void;
		children: Snippet;
	} = $props();

	// Native modal dialog: top layer, focus kept inside and handed back on close, Escape for free.
	let dialog = $state<HTMLDialogElement>();
	// A press that starts inside (selecting text, say) and ends outside is not a click on the backdrop.
	let pressedBackdrop = false;

	export function close() {
		dialog?.close();
	}

	onMount(() => dialog?.showModal());
</script>

<!-- Clicking the backdrop closes: it targets the dialog itself, its content sits in .modal-body. -->
<dialog
	bind:this={dialog}
	class="modal {className}"
	aria-labelledby={labelledby}
	{onclose}
	onpointerdown={(e) => (pressedBackdrop = e.target === dialog)}
	onclick={(e) => pressedBackdrop && e.target === dialog && close()}
>
	<div class="modal-body">
		{@render children()}
	</div>
</dialog>
