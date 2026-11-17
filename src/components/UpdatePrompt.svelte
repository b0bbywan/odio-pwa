<script lang="ts">
	let {
		version,
		onreload,
		onclose,
	}: {
		version: string;
		onreload: () => void;
		onclose: () => void;
	} = $props();
</script>

<div class="pwa-toast" role="status">
	<span>odio-api was updated to {version}</span>
	<button class="btn-primary" onclick={onreload}>Reload</button>
	<button class="btn-secondary" onclick={onclose}>Close</button>
</div>
