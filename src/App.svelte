<script lang="ts">
	import { appState } from './lib/state.svelte';
	import InstanceList from './components/InstanceList.svelte';
	import InstanceView from './components/InstanceView.svelte';
	import ReloadPrompt from './components/ReloadPrompt.svelte';
</script>

{#if appState.currentView === 'list'}
	<InstanceList />
{:else if appState.currentView === 'instance'}
	<InstanceView />
{/if}

<ReloadPrompt />
