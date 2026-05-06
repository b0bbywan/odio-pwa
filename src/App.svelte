<script lang="ts">
	import { onMount } from 'svelte';
	import Router from 'svelte-spa-router';
	import { appState } from './lib/state.svelte';
	import InstanceList from './components/InstanceList.svelte';
	import InstanceView from './components/InstanceView.svelte';
	import ReloadPrompt from './components/ReloadPrompt.svelte';

	const routes = {
		'/': InstanceList,
		'/i/:host/:port?': InstanceView,
		'*': InstanceList,
	};

	// Probes run app-wide so the TopBar switcher works on F5 into an instance,
	// not only when the list view has been visited. Idempotent connectAll won't
	// trample InstanceView's power-callback connection. Per-connection
	// visibilitychange handlers in lib/connection.ts cover the wake-on-resume
	// case, so no app-level handler here.
	onMount(() => {
		appState.connectAll();
		return () => appState.disconnectAll();
	});
</script>

<Router {routes} />
<ReloadPrompt />
