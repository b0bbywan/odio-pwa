<script lang="ts">
	import Modal from './Modal.svelte';

	let {
		displayName,
		onsave,
		ondiscard,
		oncancel,
	}: {
		displayName: string;
		onsave: () => void;
		ondiscard: () => void;
		oncancel: () => void;
	} = $props();

	let modal = $state<Modal>();
</script>

<Modal bind:this={modal} class="save-prompt" labelledby="save-prompt-title" onclose={oncancel}>
	<h3 id="save-prompt-title">Save this instance?</h3>
	<p>Add {displayName} to your list so you can come back to it later.</p>
	<div class="save-prompt-actions">
		<button class="btn-primary" onclick={onsave}>Save</button>
		<button class="btn-secondary" onclick={ondiscard}>Don't save</button>
		<button class="btn-secondary" onclick={() => modal?.close()}>Cancel</button>
	</div>
</Modal>
