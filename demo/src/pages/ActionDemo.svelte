<script lang="ts">
	import { createSvState, stringValidator } from '../../../src/index';
	import CodeBlock from '../components/CodeBlock.svelte';
	import DemoSidebar from '../components/DemoSidebar.svelte';
	import FormField from '../components/FormField.svelte';
	import PageLayout from '../components/PageLayout.svelte';
	import SourceCodeSection from '../components/SourceCodeSection.svelte';
	import StatusBadges from '../components/StatusBadges.svelte';

	const randomId = () => Math.random().toString(36).slice(2, 8);
	const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

	const sourceData = {
		title: `Task ${randomId()}`,
		description: `This is a sample task description with ID ${randomId()}`
	};

	let simulateError = $state(false);
	let lastActionResult = $state<string | undefined>();

	const {
		data,
		execute,
		state: { errors, hasErrors, isDirty, actionInProgress, actionError }
	} = createSvState(sourceData, {
		validator: (source) => ({
			title: stringValidator(source.title, 'trim').required().minLength(3).maxLength(50).getError(),
			description: stringValidator(source.description, 'trim').required().minLength(10).maxLength(200).getError()
		}),
		action: async () => {
			const delay = randomInt(100, 1000);
			await new Promise((resolve) => setTimeout(resolve, delay));

			if (simulateError) throw new Error(`Simulated server error after ${delay}ms`);

			lastActionResult = `Submitted successfully in ${delay}ms!`;
		},
		actionCompleted: (error) => {
			if (error) lastActionResult = undefined;
		}
	});

	const fillWithValidData = () => {
		data.title = `Task ${randomId()}`;
		data.description = `This is a sample task description with ID ${randomId()}`;
	};

	const handleSubmit = () => {
		lastActionResult = undefined;
		execute();
	};

	// ─────────────────────────────────────────────
	// Source code examples for the collapsible section
	// ─────────────────────────────────────────────
	const stateSourceCode = `const { data, execute, state: { errors, hasErrors, isDirty, actionInProgress, actionError } } =
  createSvState(sourceData, {
    validator: (source) => ({
      title: stringValidator(source.title, 'trim').required().minLength(3).maxLength(50).getError(),
      description: stringValidator(source.description, 'trim').required().minLength(10).getError()
    }),
    action: async () => {
      // Simulate API call with 100-1000ms delay
      const delay = randomInt(100, 1000);
      await new Promise((resolve) => setTimeout(resolve, delay));

      if (shouldFail) {
        throw new Error('Simulated server error');
      }
    },
    actionCompleted: (error) => {
      // Called after action completes (success or failure)
      console.log(error ? 'Action failed' : 'Action succeeded');
    }
  });`;

	const executeSourceCode = `// Execute the action
<button onclick={() => execute()} disabled={$hasErrors || $actionInProgress}>
  {$actionInProgress ? 'Submitting...' : 'Submit'}
</button>

// With parameters (if action accepts them)
execute({ userId: 123 });`;

	const errorSourceCode = `// Display action error
{#if $actionError}
  <div class="error">
    {$actionError.message}
  </div>
{/if}

// Check if action is in progress
{#if $actionInProgress}
  <div class="loading">Submitting...</div>
{/if}`;
</script>

<PageLayout
	description="Demonstrates async action execution with loading states and error handling."
	title="Action Demo"
>
	{#snippet main()}
		<StatusBadges hasErrors={$hasErrors} isDirty={$isDirty} />

		<div class="mb-4 flex items-center gap-2">
			<span
				class="rounded px-2.5 py-0.5 text-xs font-medium {$actionInProgress
					? 'bg-blue-100 text-blue-800'
					: 'bg-gray-100 text-gray-800'}"
			>
				{$actionInProgress ? 'In Progress' : 'Idle'}
			</span>
		</div>

		<div class="space-y-4">
			<FormField
				id="title"
				disabled={$actionInProgress}
				error={$errors?.title}
				label="Title"
				placeholder="Enter task title"
				bind:value={data.title}
			/>

			<FormField
				id="description"
				disabled={$actionInProgress}
				error={$errors?.description}
				label="Description"
				placeholder="Enter task description (min 10 characters)"
				bind:value={data.description}
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
	{/snippet}

	{#snippet sidebar()}
		<div class="w-80 flex-shrink-0 space-y-4">
			<DemoSidebar {data} errors={$errors} hasErrors={$hasErrors} isDirty={$isDirty} onFill={fillWithValidData} />

			<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
				<h6 class="mb-2 text-sm font-medium text-gray-700">Action State</h6>
				<div class="space-y-1 text-xs text-gray-600">
					<div><span class="font-medium">actionInProgress:</span> {$actionInProgress}</div>
					<div><span class="font-medium">actionError:</span> {$actionError?.message ?? 'none'}</div>
				</div>
			</div>
		</div>
	{/snippet}

	{#snippet sourceCode()}
		<SourceCodeSection>
			<CodeBlock code={stateSourceCode} title="State Setup with Action" />
			<CodeBlock code={executeSourceCode} title="Execute Action" />
			<CodeBlock code={errorSourceCode} title="Error & Loading States" />
		</SourceCodeSection>
	{/snippet}
</PageLayout>
