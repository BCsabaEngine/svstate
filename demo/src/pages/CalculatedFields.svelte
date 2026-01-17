<script lang="ts">
	import { createSvState, numberValidator, stringValidator } from '../../../src/index';
	import CodeBlock from '../components/CodeBlock.svelte';
	import DemoSidebar from '../components/DemoSidebar.svelte';
	import FormField from '../components/FormField.svelte';
	import PageLayout from '../components/PageLayout.svelte';
	import SectionHeader from '../components/SectionHeader.svelte';
	import SourceCodeSection from '../components/SourceCodeSection.svelte';
	import StatusBadges from '../components/StatusBadges.svelte';

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
				quantity: numberValidator(source.item.quantity).required().integer().min(1).max(100).getError()
			}
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

	// ─────────────────────────────────────────────
	// Source code examples for the collapsible section
	// ─────────────────────────────────────────────
	const stateSourceCode = `const sourceData = {
  productName: '',
  item: { unitPrice: 0, quantity: 1 },
  subtotal: 0, tax: 0, total: 0  // Calculated fields (set by effect)
};

const TAX_RATE = 0.08;

const { data, state: { errors, hasErrors, isDirty } } = createSvState(sourceData, {
  validator: (source) => ({
    productName: stringValidator(source.productName, 'trim').required().minLength(2).getError(),
    item: {
      unitPrice: numberValidator(source.item.unitPrice).required().positive().getError(),
      quantity: numberValidator(source.item.quantity).required().integer().min(1).max(100).getError()
    }
  }),
  effect: ({ property }) => {
    if (property === 'item.unitPrice' || property === 'item.quantity') {
      data.subtotal = data.item.unitPrice * data.item.quantity;
      data.tax = data.subtotal * TAX_RATE;
      data.total = data.subtotal + data.tax;
    }
  }
});`;

	const effectSourceCode = `effect: ({ property }) => {
  if (property === 'item.unitPrice' || property === 'item.quantity') {
    data.subtotal = data.item.unitPrice * data.item.quantity;
    data.tax = data.subtotal * TAX_RATE;
    data.total = data.subtotal + data.tax;
  }
}`;
</script>

<PageLayout
	description="Uses the effect callback to automatically compute derived values like subtotals, taxes, and totals."
	title="Calculated Fields Demo"
>
	{#snippet main()}
		<StatusBadges hasErrors={$hasErrors} isDirty={$isDirty} />

		<div class="space-y-6">
			<FormField
				id="productName"
				error={$errors?.productName}
				label="Product Name"
				placeholder="Enter product name"
				bind:value={data.productName}
			/>

			<div>
				<SectionHeader subtitle="nested object" title="Item Details" />
				<div class="grid grid-cols-2 gap-4">
					<FormField
						id="unitPrice"
						error={$errors?.item?.unitPrice}
						label="Unit Price ($)"
						min={0}
						placeholder="0.00"
						step={0.01}
						type="number"
						bind:value={data.item.unitPrice}
					/>
					<FormField
						id="quantity"
						error={$errors?.item?.quantity}
						label="Quantity"
						max={100}
						min={1}
						placeholder="1"
						type="number"
						bind:value={data.item.quantity}
					/>
				</div>
			</div>

			<div>
				<SectionHeader subtitle="computed by effect" title="Calculated Totals" />
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
	{/snippet}

	{#snippet sidebar()}
		<DemoSidebar {data} errors={$errors} hasErrors={$hasErrors} isDirty={$isDirty} onFill={fillWithValidData} />
	{/snippet}

	{#snippet sourceCode()}
		<SourceCodeSection>
			<CodeBlock code={stateSourceCode} title="State Setup with Effect" />
			<CodeBlock code={effectSourceCode} title="Effect Function" />
		</SourceCodeSection>
	{/snippet}
</PageLayout>
