<svelte:options runes />

<script lang="ts">
	import { get } from 'svelte/store';
	import { createSvState, stringValidator, undoRedoPlugin } from 'svstate';

	import CodeBlock from '$components/CodeBlock.svelte';
	import DemoSidebar from '$components/DemoSidebar.svelte';
	import FormField from '$components/FormField.svelte';
	import FormTextarea from '$components/FormTextarea.svelte';
	import PageLayout from '$components/PageLayout.svelte';
	import SourceCodeSection from '$components/SourceCodeSection.svelte';
	import StatusBadges from '$components/StatusBadges.svelte';
	import { randomId } from '$lib/utilities';

	const undoRedo = undoRedoPlugin<{
		title: string;
		content: string;
		priority: string;
	}>();

	const formatFieldName = (property: string) => {
		return property.charAt(0).toUpperCase() + property.slice(1).replaceAll(/([A-Z])/g, ' $1');
	};

	const {
		data,
		reset,
		rollback,
		state: { errors, hasErrors, isDirty, snapshots }
	} = createSvState(
		{ title: 'My Document', content: '', priority: 'medium' },
		{
			validator: (source) => ({
				title: stringValidator(source.title).prepare('trim').required().minLength(2).maxLength(100).getError(),
				content: stringValidator(source.content).prepare('trim').required().minLength(10).getError(),
				priority: ''
			}),
			effect: ({ snapshot, property }) => {
				snapshot(`Changed ${formatFieldName(property)}`);
			}
		},
		{ maxSnapshots: 10, plugins: [undoRedo] }
	);

	const fillWithValidData = () => {
		data.title = `Project Report ${randomId()}`;
		data.content = 'This is a detailed document with enough content to pass validation requirements.';
		data.priority = 'high';
	};

	let redoStack = $state(get(undoRedo.redoStack));

	$effect(() => {
		const unsubscribe = undoRedo.redoStack.subscribe((stack) => {
			redoStack = stack;
		});
		return unsubscribe;
	});

	const setupSourceCode = `import { createSvState, undoRedoPlugin } from 'svstate';

const undoRedo = undoRedoPlugin();

const { data, reset, rollback, state } = createSvState(
  { title: 'My Document', content: '', priority: 'medium' },
  {
    validator: (source) => ({ /* ... */ }),
    effect: ({ snapshot, property }) => {
      snapshot(\`Changed \${property}\`);
    }
  },
  { maxSnapshots: 10, plugins: [undoRedo] }
);`;

	const usageSourceCode = `// Undo (built-in rollback)
rollback();

// Redo (from undoRedoPlugin)
undoRedo.redo();

// Check if redo is available
undoRedo.canRedo(); // boolean

// Subscribe to redo stack
undoRedo.redoStack; // Readable<Snapshot[]>`;
</script>

<PageLayout
	description="Combines the built-in snapshot/rollback system with the undoRedoPlugin for full undo/redo support."
	title="Plugin: Undo/Redo"
>
	{#snippet main()}
		<StatusBadges hasErrors={$hasErrors} isDirty={$isDirty} />

		<div class="mb-4 flex items-center gap-2">
			<span class="rounded bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
				{$snapshots.length} Snapshot{$snapshots.length === 1 ? '' : 's'}
			</span>
			<span class="rounded bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
				{redoStack.length} Redo{redoStack.length === 1 ? '' : 's'}
			</span>
			<span class="rounded bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800"> Max: 10 </span>
		</div>

		<div class="space-y-4">
			<FormField
				id="title"
				error={$errors?.title}
				label="Title"
				placeholder="Enter document title"
				bind:value={data.title}
			/>

			<FormTextarea
				id="content"
				error={$errors?.content}
				label="Content"
				placeholder="Write your document content (min 10 chars)"
				required={true}
				rows={4}
				bind:value={data.content}
			/>

			<div>
				<label class="mb-2 block text-sm font-bold text-gray-900" for="priority">Priority</label>
				<select
					id="priority"
					class="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
					bind:value={data.priority}
				>
					<option value="low">Low</option>
					<option value="medium">Medium</option>
					<option value="high">High</option>
					<option value="critical">Critical</option>
				</select>
			</div>
		</div>

		<div class="mt-6 flex flex-wrap gap-3">
			<button
				class="flex-1 cursor-pointer rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={$snapshots.length <= 1}
				onclick={() => rollback()}
				type="button"
			>
				Undo
			</button>

			<button
				class="flex-1 cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={redoStack.length === 0}
				onclick={() => undoRedo.redo()}
				type="button"
			>
				Redo
			</button>

			{#if $isDirty}
				<button
					class="flex-1 cursor-pointer rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
					onclick={reset}
					type="button"
				>
					Reset
				</button>
			{/if}
		</div>
	{/snippet}

	{#snippet sidebar()}
		<div class="w-full flex-shrink-0 space-y-4 xl:w-96">
			<DemoSidebar
				{data}
				errors={$errors}
				hasErrors={$hasErrors}
				isDirty={$isDirty}
				onFill={fillWithValidData}
				width="xl:w-96"
			/>

			<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
				<h6 class="mb-2 text-sm font-medium text-gray-700">Snapshot History</h6>
				{#if $snapshots.length === 0}
					<p class="text-xs text-gray-500">No snapshots yet</p>
				{:else}
					<ul class="max-h-48 space-y-1 overflow-y-auto">
						{#each $snapshots as snap, index}
							<li class="flex items-center gap-2 text-xs text-gray-600">
								<span
									class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-200 text-xs font-medium text-purple-800"
								>
									{index + 1}
								</span>
								<span class="truncate">{snap.title}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
				<h6 class="mb-2 text-sm font-medium text-gray-700">Redo Stack</h6>
				{#if redoStack.length === 0}
					<p class="text-xs text-gray-500">No redo entries — undo something first</p>
				{:else}
					<ul class="max-h-48 space-y-1 overflow-y-auto">
						{#each redoStack as snap, index}
							<li class="flex items-center gap-2 text-xs text-gray-600">
								<span
									class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-medium text-blue-800"
								>
									{index + 1}
								</span>
								<span class="truncate">{snap.title}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	{/snippet}

	{#snippet sourceCode()}
		<SourceCodeSection>
			<CodeBlock code={setupSourceCode} title="Setup with undoRedoPlugin" />
			<CodeBlock code={usageSourceCode} title="Undo/Redo Usage" />
		</SourceCodeSection>
	{/snippet}
</PageLayout>
