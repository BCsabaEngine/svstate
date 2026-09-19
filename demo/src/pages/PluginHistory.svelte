<svelte:options runes />

<script lang="ts">
	import { onDestroy } from 'svelte';
	import { createSvState, historyPlugin, numberValidator, stringValidator } from 'svstate';

	import CodeBlock from '$components/CodeBlock.svelte';
	import DemoSidebar from '$components/DemoSidebar.svelte';
	import FormField from '$components/FormField.svelte';
	import PageLayout from '$components/PageLayout.svelte';
	import SourceCodeSection from '$components/SourceCodeSection.svelte';
	import StatusBadges from '$components/StatusBadges.svelte';

	type Filters = { query: string; category: string; page: number };
	type Mode = 'push' | 'replace';

	const categories = ['all', 'books', 'games', 'music'];
	const URL_PARAMETERS = ['q', 'cat', 'page'];

	let mode = $state<Mode>('push');
	let currentUrl = $state(location.href);
	let historyLength = $state(history.length);

	const refreshUrl = () => {
		currentUrl = location.href;
		historyLength = history.length;
	};

	const createState = (historyMode: Mode) =>
		createSvState(
			{ query: '', category: 'all', page: 1 } as Filters,
			{
				validator: (source) => ({
					query: stringValidator(source.query).maxLength(30).getError(),
					category: stringValidator(source.category).in(categories).getError(),
					page: numberValidator(source.page).required().integer().min(1).getError()
				})
			},
			{
				plugins: [
					historyPlugin<Filters>({
						fields: { query: 'q', category: 'cat', page: 'page' },
						mode: historyMode,
						// URL params are strings; the numeric field needs converting back
						deserialize: (parameter, field) => (field === 'page' ? Number(parameter) : parameter)
					})
				]
			}
		);

	// $state.raw: the state object is already reactive, Svelte must not wrap it in a second proxy
	let stateInstance = $state.raw(createState('push'));

	const errors = $derived(stateInstance.state.errors);
	const hasErrors = $derived(stateInstance.state.hasErrors);
	const isDirty = $derived(stateInstance.state.isDirty);

	const changeMode = (next: Mode) => {
		mode = next;
		stateInstance.destroy();
		stateInstance = createState(next);
		refreshUrl();
	};

	const fillWithValidData = () => {
		stateInstance.batch((draft) => {
			draft.query = 'svelte';
			draft.category = 'books';
			draft.page = 2;
		});
	};

	// Follow the address bar: state writes update it synchronously, back/forward fires popstate
	$effect(() => {
		void stateInstance.data.query;
		void stateInstance.data.category;
		void stateInstance.data.page;
		refreshUrl();
	});

	$effect(() => {
		addEventListener('popstate', refreshUrl);
		return () => removeEventListener('popstate', refreshUrl);
	});

	onDestroy(() => {
		stateInstance.destroy();
		// Leave the address bar clean for the other demos
		const url = new URL(location.href);
		for (const parameter of URL_PARAMETERS) url.searchParams.delete(parameter);
		history.replaceState({}, '', url.href);
	});

	const setupSourceCode = `import { createSvState, historyPlugin } from 'svstate';

const history = historyPlugin({
  // state field -> URL parameter
  fields: { query: 'q', category: 'cat', page: 'page' },
  mode: 'push',   // 'push' adds a history entry per change, 'replace' rewrites the current one
  // URL params are strings: convert back for non-string fields
  deserialize: (parameter, field) => (field === 'page' ? Number(parameter) : parameter)
});

const { data, reset } = createSvState(
  { query: '', category: 'all', page: 1 },
  { validator },
  { plugins: [history] }
);`;

	const behaviorSourceCode = `// On creation: URL params are applied to the state (and become the baseline,
// so the form starts clean and reset() returns to the URL values)

data.query = 'svelte';
// URL -> ?q=svelte             (pushState in 'push' mode, replaceState in 'replace' mode)

// Back / forward (popstate): the state follows the URL.
// A parameter that is missing from the URL restores the field's initial value,
// so going back to "?" clears the query instead of keeping a stale one.
// Applying the URL never writes it back, so back/forward doesn't add history entries.

reset();
// State returns to its initial values and the URL is rewritten to match.

history.syncFromUrl();  // re-read the URL manually`;
</script>

<PageLayout
	description="Syncs filter fields with the URL query string using historyPlugin. Try changing fields, then use the browser back/forward buttons."
	title="Plugin: History (URL sync)"
>
	{#snippet main()}
		<StatusBadges hasErrors={$hasErrors} isDirty={$isDirty} />

		<div class="mb-4 flex flex-wrap items-center gap-4 text-sm text-gray-800">
			<span class="font-medium">mode:</span>
			<label class="inline-flex cursor-pointer items-center gap-1.5">
				<input name="history-mode" checked={mode === 'push'} onchange={() => changeMode('push')} type="radio" />
				push
			</label>
			<label class="inline-flex cursor-pointer items-center gap-1.5">
				<input name="history-mode" checked={mode === 'replace'} onchange={() => changeMode('replace')} type="radio" />
				replace
			</label>
		</div>

		<div class="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
			<div><span class="font-medium">URL:</span> <span class="break-all font-mono">{currentUrl}</span></div>
			<div class="mt-1"><span class="font-medium">history.length:</span> {historyLength}</div>
		</div>

		<div class="space-y-4">
			<FormField
				id="query"
				error={$errors?.query}
				label="Search"
				placeholder="Type to update ?q="
				required={false}
				bind:value={stateInstance.data.query}
			/>

			<div>
				<label class="mb-2 block text-sm text-gray-900" for="category">Category</label>
				<select
					id="category"
					class="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
					bind:value={stateInstance.data.category}
				>
					{#each categories as category (category)}
						<option value={category}>{category}</option>
					{/each}
				</select>
			</div>

			<FormField
				id="page"
				error={$errors?.page}
				label="Page"
				min={1}
				type="number"
				bind:value={stateInstance.data.page}
			/>
		</div>

		<div class="mt-6 flex flex-wrap gap-2">
			<button
				class="cursor-pointer rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300"
				onclick={() => history.back()}
				type="button"
			>
				← Back
			</button>
			<button
				class="cursor-pointer rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300"
				onclick={() => history.forward()}
				type="button"
			>
				Forward →
			</button>
			<button
				class="cursor-pointer rounded-lg bg-yellow-100 px-4 py-2 text-sm font-medium text-yellow-800 hover:bg-yellow-200"
				onclick={() => stateInstance.reset()}
				type="button"
			>
				Reset
			</button>
		</div>
	{/snippet}

	{#snippet sidebar()}
		<DemoSidebar
			data={stateInstance.data}
			errors={$errors}
			hasErrors={$hasErrors}
			isDirty={$isDirty}
			onFill={fillWithValidData}
		/>
	{/snippet}

	{#snippet sourceCode()}
		<SourceCodeSection>
			<CodeBlock code={setupSourceCode} title="Plugin Setup" />
			<CodeBlock code={behaviorSourceCode} title="Behavior" />
		</SourceCodeSection>
	{/snippet}
</PageLayout>
