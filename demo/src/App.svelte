<script lang="ts">
	import './app.postcss';

	import ActionDemo from './pages/ActionDemo.svelte';
	import ArrayProperty from './pages/ArrayProperty.svelte';
	import AsyncValidation from './pages/AsyncValidation.svelte';
	import BasicValidation from './pages/BasicValidation.svelte';
	import CalculatedClass from './pages/CalculatedClass.svelte';
	import CalculatedFields from './pages/CalculatedFields.svelte';
	import NestedObjects from './pages/NestedObjects.svelte';
	import OptionsDemo from './pages/OptionsDemo.svelte';
	import ResetDemo from './pages/ResetDemo.svelte';
	import SnapshotDemo from './pages/SnapshotDemo.svelte';
	import ZodValidation from './pages/ZodValidation.svelte';

	type DemoMode =
		| 'basic-validation'
		| 'nested-objects'
		| 'array-property'
		| 'calculated-fields'
		| 'calculated-class'
		| 'reset-demo'
		| 'snapshot-demo'
		| 'action-demo'
		| 'async-validation'
		| 'options-demo'
		| 'zod-validation';

	const demoModes: { value: DemoMode; name: string }[] = [
		{ value: 'basic-validation', name: 'Basic Validation' },
		{ value: 'nested-objects', name: 'Nested Objects' },
		{ value: 'array-property', name: 'Array Property' },
		{ value: 'calculated-fields', name: 'Calculated Fields' },
		{ value: 'calculated-class', name: 'State with Methods' },
		{ value: 'reset-demo', name: 'Reset' },
		{ value: 'snapshot-demo', name: 'Snapshot & Rollback' },
		{ value: 'action-demo', name: 'Action & Error' },
		{ value: 'async-validation', name: 'Async Validation' },
		{ value: 'options-demo', name: 'Options' },
		{ value: 'zod-validation', name: 'Zod Integration' }
	];

	let selectedMode: DemoMode = $state('basic-validation');

	/*global __PKG_VERSION__*/
	const APP_VERSION = __PKG_VERSION__;
	/*global __BASE_URL__*/
	const BASE_URL = __BASE_URL__;
</script>

<div class="min-h-screen bg-gray-100 p-4 md:p-8">
	<!-- Header -->
	<header class="mb-6 flex flex-col items-center gap-4 text-center sm:mb-8 sm:flex-row sm:text-left">
		<img class="h-20 w-20 sm:h-32 sm:w-32" alt="svstate logo" src={`${BASE_URL}/favicon.png`} />
		<div class="flex-1">
			<h1 class="text-2xl font-bold text-gray-900 sm:text-4xl">
				<a
					class="ml-1 inline-flex items-center text-gray-500 transition-colors hover:text-gray-900"
					href="https://github.com/BCsabaEngine/svstate"
					rel="noopener noreferrer"
					target="_blank"
					title="View on GitHub"
				>
					<svg class="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" viewBox="0 0 24 24">
						<path
							d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
						/>
					</svg>
				</a>
				svstate
				<span class="ml-2 text-base font-normal text-gray-500 sm:text-xl">
					v{APP_VERSION}
				</span>
			</h1>
			<p class="mt-2 text-sm text-gray-600 sm:text-base">
				A Svelte 5 library that provides a supercharged $state() with deep reactive proxies, validation, snapshot/undo,
				and side effects — built for complex, real-world applications.
			</p>
			<div
				class="mt-2 inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 font-mono text-xs text-white"
			>
				<span class="text-green-400">$</span>
				<span>npm i svstate</span>
				<button
					class="ml-1 cursor-pointer rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
					onclick={() => navigator.clipboard.writeText(`npm i svstate@${APP_VERSION}`)}
					title="Copy to clipboard"
					type="button"
				>
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
						/>
					</svg>
				</button>
			</div>
			<a
				class="hidden items-center px-2 py-2 font-mono text-xs text-gray-700 transition-colors hover:bg-gray-300 sm:inline-flex"
				href={`${BASE_URL}/llms.txt`}
				title="AI-readable documentation"
			>
				llms.txt
			</a>
		</div>
	</header>

	<!-- Main content -->
	<div class="flex flex-col gap-4 lg:flex-row lg:gap-6">
		<!-- Left sidebar -->
		<aside class="w-full lg:w-64 lg:flex-shrink-0">
			<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
				<label class="mb-2 block text-sm font-medium text-gray-900" for="demo-select">Demo Mode</label>
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
		<main class="min-w-0 flex-1">
			{#if selectedMode === 'basic-validation'}
				<BasicValidation />
			{:else if selectedMode === 'nested-objects'}
				<NestedObjects />
			{:else if selectedMode === 'array-property'}
				<ArrayProperty />
			{:else if selectedMode === 'calculated-fields'}
				<CalculatedFields />
			{:else if selectedMode === 'calculated-class'}
				<CalculatedClass />
			{:else if selectedMode === 'reset-demo'}
				<ResetDemo />
			{:else if selectedMode === 'snapshot-demo'}
				<SnapshotDemo />
			{:else if selectedMode === 'action-demo'}
				<ActionDemo />
			{:else if selectedMode === 'async-validation'}
				<AsyncValidation />
			{:else if selectedMode === 'options-demo'}
				<OptionsDemo />
			{:else if selectedMode === 'zod-validation'}
				<ZodValidation />
			{/if}
		</main>
	</div>
</div>
