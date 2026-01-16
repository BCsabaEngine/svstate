<script lang="ts">
	import { arrayValidator, createSvState, stringValidator } from '../../../src/index';
	import ErrorText from '../components/ErrorText.svelte';

	type ItemErrors = Record<string, { name?: string; email?: string }>;

	let showSourceCode = $state(false);

	const stateSourceCode = `const sourceData = {
  listName: '',
  items: [] as { name: string; email: string }[]
};

const {
  data,
  state: { errors, hasErrors, isDirty }
} = createSvState(sourceData, {
  validator: (source) => ({
    listName: stringValidator(source.listName, 'trim')
      .required()
      .minLength(2)
      .getError(),
    items: arrayValidator(source.items)
      .required()
      .minLength(1)
      .getError(),
    // Per-item validation using indexed keys
    ...Object.fromEntries(
      source.items.map((item, index) => [
        \`item_\${index}\`,
        {
          name: stringValidator(item.name, 'trim')
            .required()
            .minLength(2)
            .getError(),
          email: stringValidator(item.email, 'trim')
            .required()
            .email()
            .getError()
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
</script>

<div class="flex gap-6">
	<div class="max-w-xl flex-1 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<h5 class="mb-4 text-xl font-medium text-gray-900">Array Property Demo</h5>

		<div class="mb-4 flex gap-2">
			<span
				class="rounded px-2.5 py-0.5 text-xs font-medium {$hasErrors
					? 'bg-red-100 text-red-800'
					: 'bg-green-100 text-green-800'}"
			>
				{$hasErrors ? 'Has Errors' : 'Valid'}
			</span>
			<span
				class="rounded px-2.5 py-0.5 text-xs font-medium {$isDirty
					? 'bg-yellow-100 text-yellow-800'
					: 'bg-gray-100 text-gray-800'}"
			>
				{$isDirty ? 'Modified' : 'Clean'}
			</span>
		</div>

		<div class="space-y-6">
			<div>
				<label class="mb-2 block text-sm font-bold text-gray-900" for="listName">List Name</label>
				<input
					id="listName"
					class="block w-full rounded-lg border p-2.5 text-sm {$errors?.listName
						? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
						: 'border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-500 focus:ring-blue-500'}"
					placeholder="Enter list name"
					type="text"
					bind:value={data.listName}
				/>
				<ErrorText error={$errors?.listName ?? ''} />
			</div>

			<div>
				<div class="mb-3 flex items-center justify-between border-b border-gray-200 pb-2">
					<h6 class="text-sm font-semibold text-gray-700">
						Contacts
						<span class="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600">
							{data.items.length} items
						</span>
					</h6>
					<button
						class="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
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
					<div class="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
						<p class="text-sm text-gray-500">
							No contacts yet. Click "Add Contact" to get started.
						</p>
					</div>
				{:else}
					<div class="space-y-3">
						{#each data.items as item, index}
							<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
								<div class="mb-3 flex items-center justify-between">
									<span class="text-xs font-medium text-gray-500">Contact #{index + 1}</span>
									<button
										class="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
										onclick={() => removeItem(index)}
										type="button"
									>
										Remove
									</button>
								</div>
								<div class="grid grid-cols-2 gap-3">
									<div>
										<label
											class="mb-1 block text-xs font-bold text-gray-700"
											for="item-name-{index}">Name</label
										>
										<input
											id="item-name-{index}"
											class="block w-full rounded-lg border p-2 text-sm {($errors as ItemErrors)?.[
												`item_${index}`
											]?.name
												? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400'
												: 'border-gray-300 bg-white text-gray-900'}"
											placeholder="Enter name"
											type="text"
											bind:value={item.name}
										/>
										<ErrorText error={($errors as ItemErrors)?.[`item_${index}`]?.name ?? ''} />
									</div>
									<div>
										<label
											class="mb-1 block text-xs font-bold text-gray-700"
											for="item-email-{index}">Email</label
										>
										<input
											id="item-email-{index}"
											class="block w-full rounded-lg border p-2 text-sm {($errors as ItemErrors)?.[
												`item_${index}`
											]?.email
												? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400'
												: 'border-gray-300 bg-white text-gray-900'}"
											placeholder="Enter email"
											type="email"
											bind:value={item.email}
										/>
										<ErrorText error={($errors as ItemErrors)?.[`item_${index}`]?.email ?? ''} />
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="w-96 flex-shrink-0 space-y-4">
		<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
			<h6 class="mb-2 text-sm font-medium text-gray-700">State Object</h6>
			<pre class="overflow-auto text-xs text-gray-600">{JSON.stringify(data, undefined, 2)}</pre>
		</div>

		<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
			<h6 class="mb-2 text-sm font-medium text-gray-700">State Info</h6>
			<div class="space-y-1 text-xs text-gray-600">
				<div><span class="font-medium">isDirty:</span> {$isDirty}</div>
				<div><span class="font-medium">hasErrors:</span> {$hasErrors}</div>
			</div>
		</div>

		<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
			<h6 class="mb-2 text-sm font-medium text-gray-700">Errors</h6>
			<pre class="overflow-auto text-xs text-gray-600">{JSON.stringify($errors, undefined, 2)}</pre>
		</div>
		<button
			class="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
			onclick={fillWithValidData}
			type="button"
		>
			Fill with Valid Data
		</button>
	</div>
</div>

<div class="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm">
	<button
		class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-50 {showSourceCode
			? 'border-b border-gray-200'
			: ''}"
		onclick={() => (showSourceCode = !showSourceCode)}
		type="button"
	>
		<span>Source Code</span>
		<svg
			class="h-5 w-5 transform transition-transform {showSourceCode ? 'rotate-180' : ''}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
		</svg>
	</button>

	{#if showSourceCode}
		<div class="space-y-4 p-4">
			<div>
				<h6 class="mb-2 text-sm font-medium text-gray-700">
					State Setup with Array Item Validation
				</h6>
				<pre
					class="overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">{stateSourceCode}</pre>
			</div>
			<div>
				<h6 class="mb-2 text-sm font-medium text-gray-700">Array Form Binding Examples</h6>
				<pre
					class="overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">{formSourceCode}</pre>
			</div>
		</div>
	{/if}
</div>
