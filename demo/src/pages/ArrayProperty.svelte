<svelte:options runes />

<script lang="ts">
	import { onDestroy } from 'svelte';
	import { arrayValidator, createSvState, stringValidator } from 'svstate';

	import ArrayItemCard from '$components/ArrayItemCard.svelte';
	import CodeBlock from '$components/CodeBlock.svelte';
	import DemoSidebar from '$components/DemoSidebar.svelte';
	import EmptyState from '$components/EmptyState.svelte';
	import ErrorText from '$components/ErrorText.svelte';
	import FormField from '$components/FormField.svelte';
	import PageLayout from '$components/PageLayout.svelte';
	import SourceCodeSection from '$components/SourceCodeSection.svelte';
	import StatusBadges from '$components/StatusBadges.svelte';
	import { randomId } from '$lib/utilities';

	type Contact = { id: string; name: string; email: string };

	const sourceData = {
		listName: '',
		items: [] as Contact[]
	};

	const {
		data,
		batch,
		destroy,
		state: { errors, hasErrors, isDirty, isDirtyByField }
	} = createSvState(sourceData, {
		validator: (source) => ({
			listName: stringValidator(source.listName).prepare('trim').required().minLength(2).getError(),
			// Error of the array as a whole...
			items: arrayValidator(source.items).required().minLength(1).getError(),
			// ...and one error object per row, in the same order as the rows
			rows: source.items.map((item) => ({
				name: stringValidator(item.name).prepare('trim').required().minLength(2).getError(),
				email: stringValidator(item.email).prepare('trim').required().email().getError()
			}))
		})
	});

	onDestroy(destroy);

	// Array methods report a single change per call, so validation and effects run once
	const addItem = () => {
		data.items.push({ id: randomId(), name: '', email: '' });
	};

	const removeItem = (index: number) => {
		data.items.splice(index, 1);
	};

	const fillWithValidData = () => {
		batch((draft) => {
			draft.listName = `Contact List ${randomId()}`;
			draft.items = [
				{ id: randomId(), name: 'John Doe', email: 'john@example.com' },
				{ id: randomId(), name: 'Jane Smith', email: 'jane@example.com' },
				{ id: randomId(), name: 'Bob Wilson', email: 'bob@example.com' }
			];
		});
	};

	// ─────────────────────────────────────────────
	// Source code examples for the collapsible section
	// ─────────────────────────────────────────────
	const stateSourceCode = `const sourceData = {
  listName: '',
  items: [] as { id: string; name: string; email: string }[]
};

const { data, batch, state: { errors, hasErrors, isDirty, isDirtyByField } } = createSvState(sourceData, {
  validator: (source) => ({
    listName: stringValidator(source.listName).prepare('trim').required().minLength(2).getError(),
    // Error of the array as a whole
    items: arrayValidator(source.items).required().minLength(1).getError(),
    // One error object per row: Validator accepts arrays, no casts needed
    rows: source.items.map((item) => ({
      name: stringValidator(item.name).prepare('trim').required().minLength(2).getError(),
      email: stringValidator(item.email).prepare('trim').required().email().getError()
    }))
  })
});`;

	const mutationSourceCode = `// Array methods report ONE change per call (effect, plugins and
// validation run once), not one per shifted index
data.items.push({ id: randomId(), name: '', email: '' });
data.items.splice(index, 1);

// Fields inside a row report their indexed path:
data.items[2].email = 'x@y.z';   // property "items.2.email"
// isDirtyByField: { 'items.2.email': true, 'items.2': true, items: true }

// batch() runs one validation pass for the name + whole array swap
batch((draft) => {
  draft.listName = 'Contact List';
  draft.items = [{ id: randomId(), name: 'John Doe', email: 'john@example.com' }];
});`;

	const formSourceCode = `{#each data.items as item, index (item.id)}
  <input bind:value={data.items[index].name} />
  <ErrorText error={$errors?.rows?.[index]?.name ?? ''} />

  <input bind:value={data.items[index].email} />
  <ErrorText error={$errors?.rows?.[index]?.email ?? ''} />

  <!-- per-field dirty state of a row -->
  {#if $isDirtyByField[\`items.\${index}.email\`]} ... {/if}
{/each}`;

	const asyncSourceCode = `// Async validators are keyed by path, and rows have indexed paths,
// so a validator can target one row. Keys are static, so this fits a
// known set of rows (the path only fires for edits of that exact row):
asyncValidator: {
  'items.0.email': async (value, source, signal) => {
    const res = await fetch(\`/api/email-taken?e=\${value}\`, { signal });
    return (await res.json()).taken ? 'Already registered' : '';
  }
}`;
</script>

<PageLayout
	description="Shows how to validate dynamic arrays with one error object per row (Validator accepts arrays), indexed dirty tracking, and array methods that report a single change."
	title="Array Property Demo"
>
	{#snippet main()}
		<StatusBadges hasErrors={$hasErrors} isDirty={$isDirty} />

		<div class="space-y-6">
			<FormField
				id="listName"
				error={$errors?.listName}
				label="List Name"
				placeholder="Enter list name"
				bind:value={data.listName}
			/>

			<div>
				<div class="mb-3 flex items-center justify-between border-b border-gray-200 pb-2">
					<h6 class="text-sm font-semibold text-gray-700">
						Contacts
						<span class="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600">
							{data.items.length} items
						</span>
					</h6>
					<button
						class="cursor-pointer rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
						onclick={addItem}
						type="button"
					>
						+ Add Contact
					</button>
				</div>

				{#if $errors?.items}
					<div class="mb-3">
						<ErrorText error={$errors.items} />
					</div>
				{/if}

				{#if data.items.length === 0}
					<EmptyState message="No contacts yet. Click &quot;Add Contact&quot; to get started." />
				{:else}
					<div class="space-y-3">
						{#each data.items as item, index (item.id)}
							<ArrayItemCard {index} label="Contact" onRemove={() => removeItem(index)}>
								<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
									<div>
										<label class="mb-1 block text-xs font-bold text-gray-700" for="item-name-{index}">
											Name
											{#if $isDirtyByField[`items.${index}.name`]}
												<span class="ml-1 inline-block h-2 w-2 rounded-full bg-amber-400" title="Modified"></span>
											{/if}
										</label>
										<input
											id="item-name-{index}"
											class="block w-full rounded-lg border p-2 text-sm {$errors?.rows?.[index]?.name
												? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400'
												: 'border-gray-300 bg-white text-gray-900'}"
											placeholder="Enter name"
											type="text"
											bind:value={data.items[index]!.name}
										/>
										<ErrorText error={$errors?.rows?.[index]?.name ?? ''} />
									</div>
									<div>
										<label class="mb-1 block text-xs font-bold text-gray-700" for="item-email-{index}">
											Email
											{#if $isDirtyByField[`items.${index}.email`]}
												<span class="ml-1 inline-block h-2 w-2 rounded-full bg-amber-400" title="Modified"></span>
											{/if}
										</label>
										<input
											id="item-email-{index}"
											class="block w-full rounded-lg border p-2 text-sm {$errors?.rows?.[index]?.email
												? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400'
												: 'border-gray-300 bg-white text-gray-900'}"
											placeholder="Enter email"
											type="email"
											bind:value={data.items[index]!.email}
										/>
										<ErrorText error={$errors?.rows?.[index]?.email ?? ''} />
									</div>
								</div>
							</ArrayItemCard>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/snippet}

	{#snippet sidebar()}
		<DemoSidebar
			{data}
			errors={$errors}
			hasErrors={$hasErrors}
			isDirty={$isDirty}
			isDirtyByField={$isDirtyByField}
			onFill={fillWithValidData}
			width="xl:w-96"
		/>
	{/snippet}

	{#snippet sourceCode()}
		<SourceCodeSection>
			<CodeBlock code={stateSourceCode} title="State Setup with Per-Row Errors" />
			<CodeBlock code={mutationSourceCode} title="Array Methods, Indexed Paths and batch()" />
			<CodeBlock code={formSourceCode} title="Array Form Binding Examples" />
			<CodeBlock code={asyncSourceCode} title="Async Validation on a Row" />
		</SourceCodeSection>
	{/snippet}
</PageLayout>
