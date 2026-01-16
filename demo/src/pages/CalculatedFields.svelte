<script lang="ts">
	import { createSvState, numberValidator, stringValidator } from '../../../src/index';
	import ErrorText from '../components/ErrorText.svelte';

	let showSourceCode = $state(false);

	const stateSourceCode = `const sourceData = {
  productName: '',
  item: {
    unitPrice: 0,
    quantity: 1
  },
  // Calculated fields (set by effect)
  subtotal: 0,
  tax: 0,
  total: 0
};

const TAX_RATE = 0.08; // 8% tax

const {
  data,
  state: { errors, hasErrors, isDirty }
} = createSvState(sourceData, {
  validator: (source) => ({
    productName: stringValidator(source.productName, 'trim')
      .required()
      .minLength(2)
      .getError(),
    item: {
      unitPrice: numberValidator(source.item.unitPrice)
        .required()
        .positive()
        .getError(),
      quantity: numberValidator(source.item.quantity)
        .required()
        .integer()
        .min(1)
        .max(100)
        .getError()
    },
    subtotal: '',
    tax: '',
    total: ''
  }),
  effect: ({ property }) => {
    // Recalculate when price or quantity changes
    if (property === 'item.unitPrice' || property === 'item.quantity') {
      data.subtotal = data.item.unitPrice * data.item.quantity;
      data.tax = data.subtotal * TAX_RATE;
      data.total = data.subtotal + data.tax;
    }
  }
});`;

	const effectSourceCode = `effect: ({ property }) => {
  // Recalculate when price or quantity changes
  if (property === 'item.unitPrice' || property === 'item.quantity') {
    data.subtotal = data.item.unitPrice * data.item.quantity;
    data.tax = data.subtotal * TAX_RATE;
    data.total = data.subtotal + data.tax;
  }
}`;

	const randomId = () => Math.random().toString(36).slice(2, 8);
	const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
	const TAX_RATE = 0.08;

	const sourceData = {
		productName: `Widget ${randomId()}`,
		item: {
			unitPrice: 0,
			quantity: 1
		},
		subtotal: 0,
		tax: 0,
		total: 0
	};

	const {
		data,
		state: { errors, hasErrors, isDirty }
	} = createSvState(sourceData, {
		validator: (source) => ({
			productName: stringValidator(source.productName, 'trim').required().minLength(2).getError(),
			item: {
				unitPrice: numberValidator(source.item.unitPrice).required().positive().getError(),
				quantity: numberValidator(source.item.quantity)
					.required()
					.integer()
					.min(1)
					.max(100)
					.getError()
			},
			subtotal: '',
			tax: '',
			total: ''
		}),
		effect: ({ property }) => {
			if (property === 'item.unitPrice' || property === 'item.quantity') {
				data.subtotal = data.item.unitPrice * data.item.quantity;
				data.tax = data.subtotal * TAX_RATE;
				data.total = data.subtotal + data.tax;
			}
		}
	});

	const fillWithValidData = () => {
		data.productName = `Widget ${randomId()}`;
		data.item.unitPrice = randomInt(10, 100);
		data.item.quantity = randomInt(1, 10);
	};

	const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
</script>

<div class="flex gap-6">
	<div class="max-w-xl flex-1 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<h5 class="mb-4 text-xl font-medium text-gray-900">Calculated Fields Demo</h5>

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
			<!-- Product Name -->
			<div>
				<label class="mb-2 block text-sm font-bold text-gray-900" for="productName"
					>Product Name</label
				>
				<input
					id="productName"
					class="block w-full rounded-lg border p-2.5 text-sm {$errors?.productName
						? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
						: 'border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-500 focus:ring-blue-500'}"
					placeholder="Enter product name"
					type="text"
					bind:value={data.productName}
				/>
				<ErrorText error={$errors?.productName ?? ''} />
			</div>

			<!-- Item Details (2-level nested) -->
			<div>
				<h6 class="mb-3 border-b border-gray-200 pb-2 text-sm font-semibold text-gray-700">
					Item Details <span class="font-normal text-gray-500">(nested object)</span>
				</h6>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="mb-2 block text-sm font-bold text-gray-900" for="unitPrice"
							>Unit Price ($)</label
						>
						<input
							id="unitPrice"
							class="block w-full rounded-lg border p-2.5 text-sm {$errors?.item?.unitPrice
								? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
								: 'border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-500 focus:ring-blue-500'}"
							min="0"
							placeholder="0.00"
							step="0.01"
							type="number"
							bind:value={data.item.unitPrice}
						/>
						<ErrorText error={$errors?.item?.unitPrice ?? ''} />
					</div>
					<div>
						<label class="mb-2 block text-sm font-bold text-gray-900" for="quantity">Quantity</label
						>
						<input
							id="quantity"
							class="block w-full rounded-lg border p-2.5 text-sm {$errors?.item?.quantity
								? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
								: 'border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-500 focus:ring-blue-500'}"
							max="100"
							min="1"
							placeholder="1"
							type="number"
							bind:value={data.item.quantity}
						/>
						<ErrorText error={$errors?.item?.quantity ?? ''} />
					</div>
				</div>
			</div>

			<!-- Calculated Fields (read-only) -->
			<div>
				<h6 class="mb-3 border-b border-gray-200 pb-2 text-sm font-semibold text-gray-700">
					Calculated Totals <span class="font-normal text-gray-500">(computed by effect)</span>
				</h6>
				<div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
					<div class="space-y-2">
						<div class="flex justify-between text-sm">
							<span class="text-gray-600">Subtotal:</span>
							<span class="font-medium text-gray-900">{formatCurrency(data.subtotal)}</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-gray-600">Tax (8%):</span>
							<span class="font-medium text-gray-900">{formatCurrency(data.tax)}</span>
						</div>
						<div class="flex justify-between border-t border-blue-200 pt-2 text-base">
							<span class="font-semibold text-gray-700">Total:</span>
							<span class="font-bold text-blue-600">{formatCurrency(data.total)}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="w-80 flex-shrink-0 space-y-4">
		<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
			<h6 class="mb-2 text-sm font-medium text-gray-700">State Object</h6>
			<pre class="overflow-auto text-sm text-gray-600">{JSON.stringify(data, undefined, 2)}</pre>
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
				<h6 class="mb-2 text-sm font-medium text-gray-700">State Setup with Effect</h6>
				<pre
					class="overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">{stateSourceCode}</pre>
			</div>
			<div>
				<h6 class="mb-2 text-sm font-medium text-gray-700">Effect Function</h6>
				<pre
					class="overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">{effectSourceCode}</pre>
			</div>
		</div>
	{/if}
</div>
