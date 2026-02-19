<script lang="ts">
	import { useRegisterSW } from 'virtual:pwa-register/svelte';

	const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
		onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
			if (registration) {
				setInterval(() => registration.update(), 60 * 60 * 1000);
			}
		},
		onRegisterError(error: unknown) {
			console.error('SW registration error:', error);
		},
	});

	function close() {
		$offlineReady = false;
		$needRefresh = false;
	}
</script>

{#if $offlineReady || $needRefresh}
	<div class="pwa-toast" role="alert">
		{#if $offlineReady}
			<span>App ready to work offline</span>
		{:else}
			<span>New content available</span>
		{/if}
		{#if $needRefresh}
			<button class="btn-primary" onclick={() => updateServiceWorker(true)}>Reload</button>
		{/if}
		<button class="btn-secondary" onclick={close}>Close</button>
	</div>
{/if}
