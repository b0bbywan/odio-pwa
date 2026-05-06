<script lang="ts">
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

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') oncancel();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="save-prompt-backdrop" onclick={oncancel}></div>
<div class="save-prompt" role="dialog" aria-modal="true" aria-labelledby="save-prompt-title">
	<h3 id="save-prompt-title">Save this instance?</h3>
	<p>Add {displayName} to your list so you can come back to it later.</p>
	<div class="save-prompt-actions">
		<button class="btn-primary" onclick={onsave}>Save</button>
		<button class="btn-secondary" onclick={ondiscard}>Don't save</button>
		<button class="btn-secondary" onclick={oncancel}>Cancel</button>
	</div>
</div>
