<svelte:options runes />

<script lang="ts">
	import { createSvState, numberValidator, stringValidator } from 'svstate';

	import CodeBlock from '$components/CodeBlock.svelte';
	import DemoSidebar from '$components/DemoSidebar.svelte';
	import FormField from '$components/FormField.svelte';
	import PageLayout from '$components/PageLayout.svelte';
	import SectionHeader from '$components/SectionHeader.svelte';
	import SourceCodeSection from '$components/SourceCodeSection.svelte';
	import StatusBadges from '$components/StatusBadges.svelte';
	import { randomId, randomInt } from '$lib/utilities';

	const TAX_RATE = 0.08;

	// Define the state type with methods
	type SourceData = {
		productName: string;
		item: { unitPrice: number; quantity: number };
		subtotal: number;
		tax: number;
		total: number;
		formatTotal: () => string;
		formatCurrency: (value: number) => string;
		calculateTotals: (taxRate?: number) => void;
	};

	// Create initial state as a plain object with methods
	const createSourceData = (): SourceData => ({
		productName: `Widget ${randomId()}`,
		item: { unitPrice: 0, quantity: 1 },
		subtotal: 0,
		tax: 0,
		total: 0,
		formatTotal() {
			return `$${this.total.toFixed(2)}`;
		},
		formatCurrency(value: number) {
			return `$${value.toFixed(2)}`;
		},
		calculateTotals(taxRate: number = TAX_RATE) {
			this.subtotal = this.item.unitPrice * this.item.quantity;
			this.tax = this.subtotal * taxRate;
			this.total = this.subtotal + this.tax;
		}
	});

	const {
		data,
		state: { errors, hasErrors, isDirty }
	} = createSvState(createSourceData(), {
		validator: (source) => ({
			productName: stringValidator(source.productName).prepare('trim').required().minLength(2).getError(),
			item: {
				unitPrice: numberValidator(source.item.unitPrice).required().positive().getError(),
				quantity: numberValidator(source.item.quantity).required().integer().min(1).max(100).getError()
			}
		}),
		effect: ({ property }) => {
			if (property === 'item.unitPrice' || property === 'item.quantity') data.calculateTotals();
		}
	});

	const fillWithValidData = () => {
		data.productName = `Widget ${randomId()}`;
		data.item.unitPrice = randomInt(10, 100);
		data.item.quantity = randomInt(1, 10);
	};

	// ─────────────────────────────────────────────
	// Source code examples for the collapsible section
	// ─────────────────────────────────────────────
	const declarationSourceCode = `// Define state type with methods
type SourceData = {
  productName: string;
  item: { unitPrice: number; quantity: number };
  subtotal: number;
  tax: number;
  total: number;
  formatTotal: () => string;
  formatCurrency: (value: number) => string;
  calculateTotals: (taxRate?: number) => void;
};

// Create initial state as object with methods
const createSourceData = (): SourceData => ({
  productName: '',
  item: { unitPrice: 0, quantity: 1 },
  subtotal: 0,
  tax: 0,
  total: 0,
  formatTotal() {
    return \`$\${this.total.toFixed(2)}\`;
  },
  formatCurrency(value: number) {
    return \`$\${value.toFixed(2)}\`;
  },
  calculateTotals(taxRate: number = 0.08) {
    this.subtotal = this.item.unitPrice * this.item.quantity;
    this.tax = this.subtotal * taxRate;
    this.total = this.subtotal + this.tax;
  }
});`;

	const stateSourceCode = `const { data, state: { errors, hasErrors, isDirty } } = createSvState(createSourceData(), {
  validator: (source) => ({
    productName: stringValidator(source.productName).prepare('trim').required().minLength(2).getError(),
    item: {
      unitPrice: numberValidator(source.item.unitPrice).required().positive().getError(),
      quantity: numberValidator(source.item.quantity).required().integer().min(1).max(100).getError()
    }
  }),
  effect: ({ property }) => {
    if (property === 'item.unitPrice' || property === 'item.quantity') {
      data.calculateTotals();  // Call method on state object!
    }
  }
});`;

	const templateSourceCode = `<!-- Use class methods for formatting -->
<span>{data.formatCurrency(data.subtotal)}</span>
<span>{data.formatTotal()}</span>`;
</script>

<PageLayout
	description="Demonstrates using objects with methods as state. The effect callback can call methods directly on the state object."
	title="State with Methods Demo"
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
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
				<SectionHeader subtitle="computed by method" title="Calculated Totals" />
				<div class="rounded-lg border border-purple-200 bg-purple-50 p-4">
					<div class="space-y-2">
						<div class="flex justify-between text-sm">
							<span class="text-gray-600">Subtotal:</span>
							<span class="font-medium text-gray-900">{data.formatCurrency(data.subtotal)}</span>
						</div>
						<div class="flex justify-between text-sm">
							<span class="text-gray-600">Tax (8%):</span>
							<span class="font-medium text-gray-900">{data.formatCurrency(data.tax)}</span>
						</div>
						<div class="flex justify-between border-t border-purple-200 pt-2 text-base">
							<span class="font-semibold text-gray-700">Total:</span>
							<span class="font-bold text-purple-600">{data.formatTotal()}</span>
						</div>
					</div>
				</div>
				<p class="mt-2 text-xs text-gray-500">
					Values formatted using methods on state: <code class="rounded bg-gray-100 px-1">data.formatCurrency()</code>
					and
					<code class="rounded bg-gray-100 px-1">data.formatTotal()</code>
				</p>
			</div>
		</div>
	{/snippet}

	{#snippet sidebar()}
		<DemoSidebar {data} errors={$errors} hasErrors={$hasErrors} isDirty={$isDirty} onFill={fillWithValidData} />
	{/snippet}

	{#snippet sourceCode()}
		<SourceCodeSection>
			<CodeBlock code={declarationSourceCode} title="Class Definition" />
			<CodeBlock code={stateSourceCode} title="State Setup with Class Instance" />
			<CodeBlock code={templateSourceCode} title="Template Usage" />
		</SourceCodeSection>
	{/snippet}
</PageLayout>
