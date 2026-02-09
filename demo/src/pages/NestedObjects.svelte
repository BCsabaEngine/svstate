<svelte:options runes />

<script lang="ts">
	import { createSvState, stringValidator } from 'svstate';

	import CodeBlock from '$components/CodeBlock.svelte';
	import DemoSidebar from '$components/DemoSidebar.svelte';
	import FormField from '$components/FormField.svelte';
	import NestedSection from '$components/NestedSection.svelte';
	import PageLayout from '$components/PageLayout.svelte';
	import SectionHeader from '$components/SectionHeader.svelte';
	import SourceCodeSection from '$components/SourceCodeSection.svelte';
	import StatusBadges from '$components/StatusBadges.svelte';
	import { randomId, randomInt } from '$lib/utilities';

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

	const {
		data,
		state: { errors, hasErrors, isDirty, isDirtyByField }
	} = createSvState(sourceData, {
		validator: (source) => ({
			name: stringValidator(source.name).prepare('trim').required().minLength(2).maxLength(50).getError(),
			address: {
				street: stringValidator(source.address.street).prepare('trim').required().minLength(5).getError(),
				city: stringValidator(source.address.city).prepare('trim').required().minLength(2).getError(),
				zip: stringValidator(source.address.zip).prepare('trim').required().minLength(5).maxLength(10).getError()
			},
			company: {
				name: stringValidator(source.company.name).prepare('trim').required().minLength(2).getError(),
				department: stringValidator(source.company.department).prepare('trim').maxLength(50).getError(),
				contact: {
					phone: stringValidator(source.company.contact.phone).prepare('trim').required().minLength(10).getError(),
					email: stringValidator(source.company.contact.email).prepare('trim').required().email().getError()
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

	// ─────────────────────────────────────────────
	// Source code examples for the collapsible section
	// ─────────────────────────────────────────────
	const stateSourceCode = `const sourceData = {
  name: '',
  address: { street: '', city: '', zip: '' },       // 2-level nested
  company: {                                         // 3-level nested
    name: '',
    department: '',
    contact: { phone: '', email: '' }
  }
};

const { data, state: { errors, hasErrors, isDirty, isDirtyByField } } = createSvState(sourceData, {
  validator: (source) => ({
    name: stringValidator(source.name).prepare('trim').required().minLength(2).maxLength(50).getError(),
    address: {
      street: stringValidator(source.address.street).prepare('trim').required().minLength(5).getError(),
      city: stringValidator(source.address.city).prepare('trim').required().minLength(2).getError(),
      zip: stringValidator(source.address.zip).prepare('trim').required().minLength(5).maxLength(10).getError()
    },
    company: {
      name: stringValidator(source.company.name).prepare('trim').required().minLength(2).getError(),
      department: stringValidator(source.company.department).prepare('trim').maxLength(50).getError(),
      contact: {
        phone: stringValidator(source.company.contact.phone).prepare('trim').required().minLength(10).getError(),
        email: stringValidator(source.company.contact.email).prepare('trim').required().email().getError()
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
</script>

<PageLayout
	description="Illustrates validating deeply nested object structures with multi-level property paths."
	title="Nested Objects Demo"
>
	{#snippet main()}
		<StatusBadges hasErrors={$hasErrors} isDirty={$isDirty} />

		<div class="space-y-6">
			<div>
				<SectionHeader title="Personal Info">
					{#if $isDirtyByField['name']}
						<span class="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-400" title="Modified"></span>
					{/if}
				</SectionHeader>
				<FormField
					id="name"
					error={$errors?.name}
					label="Full Name"
					placeholder="Enter your full name"
					bind:value={data.name}
				/>
			</div>

			<div>
				<SectionHeader subtitle="2-level nested" title="Address">
					{#if $isDirtyByField['address']}
						<span class="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-400" title="Modified"></span>
					{/if}
				</SectionHeader>
				<div class="space-y-4">
					<FormField
						id="street"
						error={$errors?.address?.street}
						label="Street"
						placeholder="Enter street address"
						bind:value={data.address.street}
					/>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<FormField
							id="city"
							error={$errors?.address?.city}
							label="City"
							placeholder="Enter city"
							bind:value={data.address.city}
						/>
						<FormField
							id="zip"
							error={$errors?.address?.zip}
							label="ZIP Code"
							placeholder="Enter ZIP"
							bind:value={data.address.zip}
						/>
					</div>
				</div>
			</div>

			<div>
				<SectionHeader subtitle="3-level nested" title="Company">
					{#if $isDirtyByField['company']}
						<span class="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-400" title="Modified"></span>
					{/if}
				</SectionHeader>
				<div class="space-y-4">
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<FormField
							id="company-name"
							error={$errors?.company?.name}
							label="Company Name"
							placeholder="Enter company name"
							bind:value={data.company.name}
						/>
						<FormField
							id="department"
							error={$errors?.company?.department}
							label="Department"
							placeholder="Enter department"
							required={false}
							bind:value={data.company.department}
						/>
					</div>

					<NestedSection isDirty={$isDirtyByField['company.contact']} subtitle="3rd level" title="Contact Info">
						<div class="space-y-4">
							<FormField
								id="contact-phone"
								error={$errors?.company?.contact?.phone}
								label="Phone"
								placeholder="Enter phone number"
								variant="nested"
								bind:value={data.company.contact.phone}
							/>
							<FormField
								id="contact-email"
								error={$errors?.company?.contact?.email}
								label="Email"
								placeholder="Enter email address"
								type="email"
								variant="nested"
								bind:value={data.company.contact.email}
							/>
						</div>
					</NestedSection>
				</div>
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
			<CodeBlock code={stateSourceCode} title="State Setup with Nested Validation" />
			<CodeBlock code={formSourceCode} title="Nested Form Binding Examples" />
		</SourceCodeSection>
	{/snippet}
</PageLayout>
