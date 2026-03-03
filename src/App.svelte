<script lang="ts">
	import { onMount } from 'svelte';
	import { appState } from './lib/state.svelte';
	import InstanceList from './components/InstanceList.svelte';
	import InstanceView from './components/InstanceView.svelte';
	import ReloadPrompt from './components/ReloadPrompt.svelte';

	onMount(() => {
		function onPopState() {
			if (appState.currentView === 'instance') appState.goToList();
		}
		window.addEventListener('popstate', onPopState);
		return () => window.removeEventListener('popstate', onPopState);
	});
</script>

{#if appState.currentView === 'list'}
	<InstanceList />
{:else if appState.currentView === 'instance'}
	<InstanceView />
{/if}

<ReloadPrompt />
