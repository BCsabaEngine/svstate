<script lang="ts">
	import './app.postcss';

	import ArrayProperty from './pages/ArrayProperty.svelte';
	import BasicValidation from './pages/BasicValidation.svelte';
	import CalculatedFields from './pages/CalculatedFields.svelte';
	import NestedObjects from './pages/NestedObjects.svelte';

	type DemoMode = 'basic-validation' | 'nested-objects' | 'array-property' | 'calculated-fields';

	const demoModes: { value: DemoMode; name: string }[] = [
		{ value: 'basic-validation', name: 'Basic Validation' },
		{ value: 'nested-objects', name: 'Nested Objects' },
		{ value: 'array-property', name: 'Array Property' },
		{ value: 'calculated-fields', name: 'Calculated Fields' }
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
		<img class="h-32 w-32" alt="svstate logo" src={`${BASE_URL}/favicon.png`} />
		<div>
			<h1 class="text-4xl font-bold text-gray-900">
				svstate
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
				<label class="mb-2 block text-sm font-medium text-gray-900" for="demo-select"
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
			{:else if selectedMode === 'nested-objects'}
				<NestedObjects />
			{:else if selectedMode === 'array-property'}
				<ArrayProperty />
			{:else if selectedMode === 'calculated-fields'}
				<CalculatedFields />
			{/if}
		</main>
	</div>
</div>
