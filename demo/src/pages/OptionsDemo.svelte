<script lang="ts">
	import { createSvState, stringValidator } from 'svstate';

	import CodeBlock from '$components/CodeBlock.svelte';
	import DemoSidebar from '$components/DemoSidebar.svelte';
	import FormField from '$components/FormField.svelte';
	import PageLayout from '$components/PageLayout.svelte';
	import SourceCodeSection from '$components/SourceCodeSection.svelte';
	import StatusBadges from '$components/StatusBadges.svelte';
	import { randomId, randomInt } from '$lib/utilities';

	// Option controls (reactive)
	let resetDirtyOnAction = $state(true);
	let debounceValidation = $state(0);
	let persistActionError = $state(false);
	let optionsKey = $state(0);

	// Simulate error checkbox
	let simulateError = $state(false);
	let lastActionResult = $state<string | undefined>();
	let lastChangedProperty = $state<string | undefined>();

	const getInitialData = () => ({
		name: `User ${randomId()}`,
		email: `${randomId()}@example.com`
	});

	// Create initial state
	const createState = (options: {
		resetDirtyOnAction: boolean;
		debounceValidation: number;
		persistActionError: boolean;
	}) => {
		return createSvState(
			getInitialData(),
			{
				validator: (source) => ({
					name: stringValidator(source.name, 'trim').required().minLength(2).maxLength(50).getError(),
					email: stringValidator(source.email, 'trim').required().email().getError()
				}),
				effect: ({ property }) => {
					lastChangedProperty = property;
				},
				action: async () => {
					const delay = randomInt(100, 800);
					await new Promise((resolve) => setTimeout(resolve, delay));

					if (simulateError) throw new Error(`Simulated error after ${delay}ms`);

					lastActionResult = `Submitted successfully in ${delay}ms!`;
				},
				actionCompleted: (error) => {
					if (error) lastActionResult = undefined;
				}
			},
			options
		);
	};

	// Store the current state instance (use defaults to avoid lint warnings)
	let stateInstance = $state(
		createState({
			resetDirtyOnAction: true,
			debounceValidation: 0,
			persistActionError: false
		})
	);

	// Recreate state when options change
	const handleOptionsChange = () => {
		lastChangedProperty = undefined;
		lastActionResult = undefined;
		stateInstance = createState({
			resetDirtyOnAction,
			debounceValidation,
			persistActionError
		});
		optionsKey++;
	};

	// Extract stores for reactive access
	const errors = $derived(stateInstance.state.errors);
	const hasErrors = $derived(stateInstance.state.hasErrors);
	const isDirty = $derived(stateInstance.state.isDirty);
	const actionInProgress = $derived(stateInstance.state.actionInProgress);
	const actionError = $derived(stateInstance.state.actionError);

	const fillWithValidData = () => {
		stateInstance.data.name = `User ${randomId()}`;
		stateInstance.data.email = `${randomId()}@example.com`;
	};

	const handleSubmit = () => {
		lastActionResult = undefined;
		stateInstance.execute();
	};

	// ─────────────────────────────────────────────
	// Source code examples
	// ─────────────────────────────────────────────
	const optionsSourceCode = `const { data, execute, state } = createSvState(
  sourceData,
  { validator, effect, action },
  {
    // Reset isDirty to false after successful action
    resetDirtyOnAction: true,    // default: true

    // Debounce validation by N milliseconds
    debounceValidation: 0,       // default: 0 (uses queueMicrotask)

    // Keep action errors until next action (not cleared on data change)
    persistActionError: false    // default: false
  }
);`;

	const resetDirtySourceCode = `// With resetDirtyOnAction: true (default)
await execute();
// isDirty is now false

// With resetDirtyOnAction: false
await execute();
// isDirty remains true`;

	const debounceSourceCode = `// With debounceValidation: 0 (default)
// Validation runs via queueMicrotask after each change

// With debounceValidation: 500
// Validation runs 500ms after the last change
// Useful for expensive validators or rapid typing`;

	const persistErrorSourceCode = `// With persistActionError: false (default)
data.name = 'new value';
// actionError is cleared immediately

// With persistActionError: true
data.name = 'new value';
// actionError remains until next execute() call`;
</script>

<PageLayout
	description="Interactive playground for configuring createSvState options like debouncing and error persistence."
	title="Options Demo"
>
	{#snippet main()}
		{#key optionsKey}
			<StatusBadges hasErrors={$hasErrors} isDirty={$isDirty} />

			{#if lastChangedProperty}
				<div class="mb-4 rounded-lg border border-purple-200 bg-purple-50 p-3">
					<span class="text-sm text-purple-800">
						<span class="font-medium">Effect triggered:</span> property "{lastChangedProperty}" changed
					</span>
				</div>
			{/if}

			<div class="space-y-4">
				<FormField
					id="name"
					disabled={$actionInProgress}
					error={$errors?.name}
					label="Name"
					placeholder="Enter name"
					bind:value={stateInstance.data.name}
				/>

				<FormField
					id="email"
					disabled={$actionInProgress}
					error={$errors?.email}
					label="Email"
					placeholder="Enter email"
					type="email"
					bind:value={stateInstance.data.email}
				/>

				<div class="flex items-center gap-2">
					<input
						id="simulateError"
						class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={$actionInProgress}
						type="checkbox"
						bind:checked={simulateError}
					/>
					<label class="text-sm text-gray-700" for="simulateError">Simulate server error</label>
				</div>
			</div>

			{#if $actionError}
				<div class="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
					<div class="flex items-center gap-2">
						<svg class="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
							<path
								clip-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
								fill-rule="evenodd"
							/>
						</svg>
						<span class="text-sm font-medium text-red-800">{$actionError.message}</span>
					</div>
				</div>
			{/if}

			{#if lastActionResult}
				<div class="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
					<div class="flex items-center gap-2">
						<svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
							<path
								clip-rule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								fill-rule="evenodd"
							/>
						</svg>
						<span class="text-sm font-medium text-green-800">{lastActionResult}</span>
					</div>
				</div>
			{/if}

			<div class="mt-6">
				<button
					class="w-full cursor-pointer rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={$hasErrors || $actionInProgress}
					onclick={handleSubmit}
					type="button"
				>
					{#if $actionInProgress}
						<span class="inline-flex items-center gap-2">
							<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path
									class="opacity-75"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									fill="currentColor"
								></path>
							</svg>
							Submitting...
						</span>
					{:else}
						Submit
					{/if}
				</button>
			</div>
		{/key}
	{/snippet}

	{#snippet sidebar()}
		<div class="w-full flex-shrink-0 space-y-4 xl:w-80">
			<DemoSidebar
				data={stateInstance.data}
				errors={$errors}
				hasErrors={$hasErrors}
				isDirty={$isDirty}
				onFill={fillWithValidData}
			/>

			<div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
				<h6 class="mb-3 text-sm font-semibold text-blue-900">Options</h6>

				<div class="space-y-4">
					<div>
						<div class="flex items-center gap-2">
							<input
								id="resetDirtyOnAction"
								class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
								type="checkbox"
								bind:checked={resetDirtyOnAction}
							/>
							<label class="text-sm font-medium text-gray-800" for="resetDirtyOnAction">resetDirtyOnAction</label>
						</div>
						<p class="mt-1 text-xs text-gray-600">Reset isDirty after successful action</p>
					</div>

					<div>
						<label class="block text-sm font-medium text-gray-800" for="debounceValidation">
							debounceValidation (ms)
						</label>
						<input
							id="debounceValidation"
							class="mt-1 block w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:ring-blue-500"
							min="0"
							placeholder="0"
							step="100"
							type="number"
							bind:value={debounceValidation}
						/>
						<p class="mt-1 text-xs text-gray-600">Try 500ms and type quickly</p>
					</div>

					<div>
						<div class="flex items-center gap-2">
							<input
								id="persistActionError"
								class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
								type="checkbox"
								bind:checked={persistActionError}
							/>
							<label class="text-sm font-medium text-gray-800" for="persistActionError">persistActionError</label>
						</div>
						<p class="mt-1 text-xs text-gray-600">Keep errors until next action</p>
					</div>

					<button
						class="w-full cursor-pointer rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
						onclick={handleOptionsChange}
						type="button"
					>
						Apply Options
					</button>
				</div>
			</div>

			<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
				<h6 class="mb-2 text-sm font-medium text-gray-700">Current Options</h6>
				<div class="space-y-1 font-mono text-xs text-gray-600">
					<div>resetDirtyOnAction: {resetDirtyOnAction}</div>
					<div>debounceValidation: {debounceValidation}</div>
					<div>persistActionError: {persistActionError}</div>
				</div>
			</div>
		</div>
	{/snippet}

	{#snippet sourceCode()}
		<SourceCodeSection>
			<CodeBlock code={optionsSourceCode} title="Options Overview" />
			<CodeBlock code={resetDirtySourceCode} title="resetDirtyOnAction" />
			<CodeBlock code={debounceSourceCode} title="debounceValidation" />
			<CodeBlock code={persistErrorSourceCode} title="persistActionError" />
		</SourceCodeSection>
	{/snippet}
</PageLayout>
