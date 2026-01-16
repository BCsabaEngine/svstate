<script lang="ts">
	import { createSvState, stringValidator } from '../../../src/index';
	import ErrorText from '../components/ErrorText.svelte';

	let showSourceCode = $state(false);

	const stateSourceCode = `const sourceData = {
  name: '',
  // 2-level nested object
  address: {
    street: '',
    city: '',
    zip: ''
  },
  // 3-level nested object
  company: {
    name: '',
    department: '',
    contact: {
      phone: '',
      email: ''
    }
  }
};

const {
  data,
  state: { errors, hasErrors, isDirty }
} = createSvState(sourceData, {
  validator: (source) => ({
    name: stringValidator(source.name, 'trim')
      .required()
      .minLength(2)
      .maxLength(50)
      .getError(),
    address: {
      street: stringValidator(source.address.street, 'trim')
        .required()
        .minLength(5)
        .getError(),
      city: stringValidator(source.address.city, 'trim')
        .required()
        .minLength(2)
        .getError(),
      zip: stringValidator(source.address.zip, 'trim')
        .required()
        .minLength(5)
        .maxLength(10)
        .getError()
    },
    company: {
      name: stringValidator(source.company.name, 'trim')
        .required()
        .minLength(2)
        .getError(),
      department: stringValidator(source.company.department, 'trim')
        .maxLength(50)
        .getError(),
      contact: {
        phone: stringValidator(source.company.contact.phone, 'trim')
          .required()
          .minLength(10)
          .getError(),
        email: stringValidator(source.company.contact.email, 'trim')
          .required()
          .email()
          .getError()
      }
    }
  })
});`;

	const formSourceCode = `<!-- 2-level nested binding -->
<input bind:value={data.address.street} />
<ErrorText error={$errors?.address?.street ?? ''} />

<!-- 3-level nested binding -->
<input bind:value={data.company.contact.phone} />
<ErrorText error={$errors?.company?.contact?.phone ?? ''} />`;

	const sourceData = {
		name: '',
		address: {
			street: '',
			city: '',
			zip: ''
		},
		company: {
			name: '',
			department: '',
			contact: {
				phone: '',
				email: ''
			}
		}
	};

	const randomId = () => Math.random().toString(36).slice(2, 8);
	const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

	const {
		data,
		state: { errors, hasErrors, isDirty }
	} = createSvState(sourceData, {
		validator: (source) => ({
			name: stringValidator(source.name, 'trim').required().minLength(2).maxLength(50).getError(),
			address: {
				street: stringValidator(source.address.street, 'trim').required().minLength(5).getError(),
				city: stringValidator(source.address.city, 'trim').required().minLength(2).getError(),
				zip: stringValidator(source.address.zip, 'trim')
					.required()
					.minLength(5)
					.maxLength(10)
					.getError()
			},
			company: {
				name: stringValidator(source.company.name, 'trim').required().minLength(2).getError(),
				department: stringValidator(source.company.department, 'trim').maxLength(50).getError(),
				contact: {
					phone: stringValidator(source.company.contact.phone, 'trim')
						.required()
						.minLength(10)
						.getError(),
					email: stringValidator(source.company.contact.email, 'trim').required().email().getError()
				}
			}
		})
	});

	const fillWithValidData = () => {
		data.name = `John ${randomId()}`;
		data.address.street = `${randomInt(100, 9999)} Main Street`;
		data.address.city = 'New York';
		data.address.zip = `${randomInt(10_000, 99_999)}`;
		data.company.name = `Acme ${randomId()} Inc`;
		data.company.department = 'Engineering';
		data.company.contact.phone = `555-${randomInt(100, 999)}-${randomInt(1000, 9999)}`;
		data.company.contact.email = `contact@${randomId()}.com`;
	};
</script>

<div class="flex gap-6">
	<div class="max-w-xl flex-1 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<h5 class="mb-4 text-xl font-medium text-gray-900">Nested Objects Demo</h5>

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
			<!-- Top-level field -->
			<div>
				<h6 class="mb-3 border-b border-gray-200 pb-2 text-sm font-semibold text-gray-700">
					Personal Info
				</h6>
				<div>
					<label class="mb-2 block text-sm font-bold text-gray-900" for="name">Full Name</label>
					<input
						id="name"
						class="block w-full rounded-lg border p-2.5 text-sm {$errors?.name
							? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
							: 'border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-500 focus:ring-blue-500'}"
						placeholder="Enter your full name"
						type="text"
						bind:value={data.name}
					/>
					<ErrorText error={$errors?.name ?? ''} />
				</div>
			</div>

			<!-- 2-level nested: Address -->
			<div>
				<h6 class="mb-3 border-b border-gray-200 pb-2 text-sm font-semibold text-gray-700">
					Address <span class="font-normal text-gray-500">(2-level nested)</span>
				</h6>
				<div class="space-y-4">
					<div>
						<label class="mb-2 block text-sm font-bold text-gray-900" for="street">Street</label>
						<input
							id="street"
							class="block w-full rounded-lg border p-2.5 text-sm {$errors?.address?.street
								? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
								: 'border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-500 focus:ring-blue-500'}"
							placeholder="Enter street address"
							type="text"
							bind:value={data.address.street}
						/>
						<ErrorText error={$errors?.address?.street ?? ''} />
					</div>
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label class="mb-2 block text-sm font-bold text-gray-900" for="city">City</label>
							<input
								id="city"
								class="block w-full rounded-lg border p-2.5 text-sm {$errors?.address?.city
									? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
									: 'border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-500 focus:ring-blue-500'}"
								placeholder="Enter city"
								type="text"
								bind:value={data.address.city}
							/>
							<ErrorText error={$errors?.address?.city ?? ''} />
						</div>
						<div>
							<label class="mb-2 block text-sm font-bold text-gray-900" for="zip">ZIP Code</label>
							<input
								id="zip"
								class="block w-full rounded-lg border p-2.5 text-sm {$errors?.address?.zip
									? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
									: 'border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-500 focus:ring-blue-500'}"
								placeholder="Enter ZIP"
								type="text"
								bind:value={data.address.zip}
							/>
							<ErrorText error={$errors?.address?.zip ?? ''} />
						</div>
					</div>
				</div>
			</div>

			<!-- 3-level nested: Company -->
			<div>
				<h6 class="mb-3 border-b border-gray-200 pb-2 text-sm font-semibold text-gray-700">
					Company <span class="font-normal text-gray-500">(3-level nested)</span>
				</h6>
				<div class="space-y-4">
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label class="mb-2 block text-sm font-bold text-gray-900" for="company-name"
								>Company Name</label
							>
							<input
								id="company-name"
								class="block w-full rounded-lg border p-2.5 text-sm {$errors?.company?.name
									? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
									: 'border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-500 focus:ring-blue-500'}"
								placeholder="Enter company name"
								type="text"
								bind:value={data.company.name}
							/>
							<ErrorText error={$errors?.company?.name ?? ''} />
						</div>
						<div>
							<label class="mb-2 block text-sm text-gray-900" for="department">Department</label>
							<input
								id="department"
								class="block w-full rounded-lg border p-2.5 text-sm {$errors?.company?.department
									? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
									: 'border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-500 focus:ring-blue-500'}"
								placeholder="Enter department"
								type="text"
								bind:value={data.company.department}
							/>
							<ErrorText error={$errors?.company?.department ?? ''} />
						</div>
					</div>

					<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
						<h6 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
							Contact Info <span class="font-normal normal-case">(3rd level)</span>
						</h6>
						<div class="space-y-4">
							<div>
								<label class="mb-2 block text-sm font-bold text-gray-900" for="contact-phone"
									>Phone</label
								>
								<input
									id="contact-phone"
									class="block w-full rounded-lg border p-2.5 text-sm {$errors?.company?.contact
										?.phone
										? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
										: 'border-gray-300 bg-white text-gray-900 focus:border-blue-500 focus:ring-blue-500'}"
									placeholder="Enter phone number"
									type="text"
									bind:value={data.company.contact.phone}
								/>
								<ErrorText error={$errors?.company?.contact?.phone ?? ''} />
							</div>
							<div>
								<label class="mb-2 block text-sm font-bold text-gray-900" for="contact-email"
									>Email</label
								>
								<input
									id="contact-email"
									class="block w-full rounded-lg border p-2.5 text-sm {$errors?.company?.contact
										?.email
										? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
										: 'border-gray-300 bg-white text-gray-900 focus:border-blue-500 focus:ring-blue-500'}"
									placeholder="Enter email address"
									type="email"
									bind:value={data.company.contact.email}
								/>
								<ErrorText error={$errors?.company?.contact?.email ?? ''} />
							</div>
						</div>
					</div>
				</div>
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
				<h6 class="mb-2 text-sm font-medium text-gray-700">State Setup with Nested Validation</h6>
				<pre
					class="overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">{stateSourceCode}</pre>
			</div>
			<div>
				<h6 class="mb-2 text-sm font-medium text-gray-700">Nested Form Binding Examples</h6>
				<pre
					class="overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">{formSourceCode}</pre>
			</div>
		</div>
	{/if}
</div>
