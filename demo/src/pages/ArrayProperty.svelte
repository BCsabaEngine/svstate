<script lang="ts">
	import { arrayValidator, createSvState, stringValidator } from '../../../src/index';
	import ArrayItemCard from '../components/ArrayItemCard.svelte';
	import CodeBlock from '../components/CodeBlock.svelte';
	import DemoSidebar from '../components/DemoSidebar.svelte';
	import EmptyState from '../components/EmptyState.svelte';
	import ErrorText from '../components/ErrorText.svelte';
	import FormField from '../components/FormField.svelte';
	import PageLayout from '../components/PageLayout.svelte';
	import SourceCodeSection from '../components/SourceCodeSection.svelte';
	import StatusBadges from '../components/StatusBadges.svelte';

	type ItemErrors = Record<string, { name?: string; email?: string }>;

	const sourceData = {
		listName: '',
		items: [] as { name: string; email: string }[]
	};

	const {
		data,
		state: { errors, hasErrors, isDirty }
	} = createSvState(sourceData, {
		validator: (source) => ({
			listName: stringValidator(source.listName, 'trim').required().minLength(2).getError(),
			items: arrayValidator(source.items).required().minLength(1).getError(),
			...Object.fromEntries(
				source.items.map((item, index) => [
					`item_${index}`,
					{
						name: stringValidator(item.name, 'trim').required().minLength(2).getError(),
						email: stringValidator(item.email, 'trim').required().email().getError()
					}
				])
			)
		})
	});

	const addItem = () => {
		data.items = [...data.items, { name: '', email: '' }];
	};

	const removeItem = (index: number) => {
		data.items = data.items.filter((_, index_) => index_ !== index);
	};

	const randomId = () => Math.random().toString(36).slice(2, 8);

	const fillWithValidData = () => {
		data.listName = `Contact List ${randomId()}`;
		data.items = [
			{ name: 'John Doe', email: 'john@example.com' },
			{ name: 'Jane Smith', email: 'jane@example.com' },
			{ name: 'Bob Wilson', email: 'bob@example.com' }
		];
	};

	// ─────────────────────────────────────────────
	// Source code examples for the collapsible section
	// ─────────────────────────────────────────────
	const stateSourceCode = `const sourceData = {
  listName: '',
  items: [] as { name: string; email: string }[]
};

const { data, state: { errors, hasErrors, isDirty } } = createSvState(sourceData, {
  validator: (source) => ({
    listName: stringValidator(source.listName, 'trim').required().minLength(2).getError(),
    items: arrayValidator(source.items).required().minLength(1).getError(),
    // Per-item validation using indexed keys
    ...Object.fromEntries(
      source.items.map((item, index) => [
        \`item_\${index}\`,
        {
          name: stringValidator(item.name, 'trim').required().minLength(2).getError(),
          email: stringValidator(item.email, 'trim').required().email().getError()
        }
      ])
    )
  })
});`;

	const formSourceCode = `// Define type for item errors
type ItemErrors = Record<string, { name?: string; email?: string }>;

{#each data.items as item, index}
  <input bind:value={item.name} />
  <ErrorText error={($errors as ItemErrors)?.[...\`item_\${index}\`]?.name ?? ''} />

  <input bind:value={item.email} />
  <ErrorText error={($errors as ItemErrors)?.[...\`item_\${index}\`]?.email ?? ''} />
{/each}`;
</script>

<PageLayout title="Array Property Demo">
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
						{#each data.items as item, index}
							<ArrayItemCard {index} label="Contact" onRemove={() => removeItem(index)}>
								<div class="grid grid-cols-2 gap-3">
									<div>
										<label class="mb-1 block text-xs font-bold text-gray-700" for="item-name-{index}">Name</label>
										<input
											id="item-name-{index}"
											class="block w-full rounded-lg border p-2 text-sm {($errors as ItemErrors)?.[`item_${index}`]
												?.name
												? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400'
												: 'border-gray-300 bg-white text-gray-900'}"
											placeholder="Enter name"
											type="text"
											bind:value={item.name}
										/>
										<ErrorText error={($errors as ItemErrors)?.[`item_${index}`]?.name ?? ''} />
									</div>
									<div>
										<label class="mb-1 block text-xs font-bold text-gray-700" for="item-email-{index}">Email</label>
										<input
											id="item-email-{index}"
											class="block w-full rounded-lg border p-2 text-sm {($errors as ItemErrors)?.[`item_${index}`]
												?.email
												? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400'
												: 'border-gray-300 bg-white text-gray-900'}"
											placeholder="Enter email"
											type="email"
											bind:value={item.email}
										/>
										<ErrorText error={($errors as ItemErrors)?.[`item_${index}`]?.email ?? ''} />
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
			onFill={fillWithValidData}
			width="w-96"
		/>
	{/snippet}

	{#snippet sourceCode()}
		<SourceCodeSection>
			<CodeBlock code={stateSourceCode} title="State Setup with Array Item Validation" />
			<CodeBlock code={formSourceCode} title="Array Form Binding Examples" />
		</SourceCodeSection>
	{/snippet}
</PageLayout>
