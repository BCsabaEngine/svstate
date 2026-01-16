<script lang="ts">
	import './app.postcss';

	import BasicValidation from './pages/BasicValidation.svelte';

	type DemoMode = 'basic-validation' | 'effects' | 'actions' | 'snapshots';

	const demoModes: { value: DemoMode; name: string }[] = [
		{ value: 'basic-validation', name: 'Basic Validation' },
		{ value: 'effects', name: 'With Effects (Coming Soon)' },
		{ value: 'actions', name: 'With Actions (Coming Soon)' },
		{ value: 'snapshots', name: 'Snapshot/Undo (Coming Soon)' }
	];

	let selectedMode: DemoMode = $state('basic-validation');

	/*global __PKG_VERSION__*/
	const APP_VERSION = __PKG_VERSION__;
	/*global __BASE_URL__*/
	const BASE_URL = __BASE_URL__;
</script>

<div class="min-h-screen bg-gray-100 p-8">
	<!-- Header -->
	<header class="mb-8 flex items-center gap-6">
		<img src={`${BASE_URL}/favicon.png`} alt="svstate logo" class="h-32 w-32" />
		<div>
			<h1 class="text-4xl font-bold text-gray-900">svstate
			<span class="ml-2 text-xl font-normal text-gray-500">
					v{APP_VERSION}
				</span>
			</h1>
			<p class="mt-2 max-w-2xl text-gray-600">
				A Svelte 5 library that provides a supercharged $state() with deep reactive proxies,
				validation, snapshot/undo, and side effects.
			</p>
		</div>
	</header>

	<!-- Main content -->
	<div class="flex gap-6">
		<!-- Left sidebar -->
		<aside class="w-64 flex-shrink-0">
			<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<label for="demo-select" class="mb-2 block text-sm font-medium text-gray-900"
					>Demo Mode</label
				>
				<select
					id="demo-select"
					class="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
					bind:value={selectedMode}
				>
					{#each demoModes as mode}
						<option value={mode.value}>{mode.name}</option>
					{/each}
				</select>
			</div>
		</aside>

		<!-- Right content area -->
		<main class="flex-1">
			{#if selectedMode === 'basic-validation'}
				<BasicValidation />
			{:else if selectedMode === 'effects'}
				<div class="max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
					<h5 class="text-xl font-medium text-gray-500">With Effects</h5>
					<p class="mt-2 text-gray-400">Coming soon...</p>
				</div>
			{:else if selectedMode === 'actions'}
				<div class="max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
					<h5 class="text-xl font-medium text-gray-500">With Actions</h5>
					<p class="mt-2 text-gray-400">Coming soon...</p>
				</div>
			{:else if selectedMode === 'snapshots'}
				<div class="max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
					<h5 class="text-xl font-medium text-gray-500">Snapshot/Undo</h5>
					<p class="mt-2 text-gray-400">Coming soon...</p>
				</div>
			{/if}
		</main>
	</div>
</div>
