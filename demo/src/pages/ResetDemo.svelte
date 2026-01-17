<script lang="ts">
	import { createSvState, stringValidator } from 'svstate';

	import CodeBlock from '$components/CodeBlock.svelte';
	import DemoSidebar from '$components/DemoSidebar.svelte';
	import FormField from '$components/FormField.svelte';
	import FormTextarea from '$components/FormTextarea.svelte';
	import PageLayout from '$components/PageLayout.svelte';
	import SourceCodeSection from '$components/SourceCodeSection.svelte';
	import StatusBadges from '$components/StatusBadges.svelte';
	import { randomId } from '$lib/utilities';

	const sourceData = {
		firstName: 'Alice',
		lastName: 'Smith',
		email: 'alice.smith@example.com',
		phone: '',
		bio: ''
	};

	const {
		data,
		reset,
		state: { errors, hasErrors, isDirty }
	} = createSvState(sourceData, {
		validator: (source) => ({
			firstName: stringValidator(source.firstName, 'trim').required().minLength(2).maxLength(30).getError(),
			lastName: stringValidator(source.lastName, 'trim').required().minLength(2).maxLength(30).getError(),
			email: stringValidator(source.email, 'trim').required().email().getError(),
			phone: stringValidator(source.phone, 'trim').required().minLength(10).getError(),
			bio: stringValidator(source.bio).maxLength(200).getError()
		})
	});

	const fillWithValidData = () => {
		data.firstName = 'John';
		data.lastName = `Doe${randomId()}`;
		data.email = `john.doe.${randomId()}@example.com`;
		data.phone = `555-${randomId().slice(0, 3)}-${randomId().slice(0, 4)}`;
		data.bio = 'Software developer with a passion for clean code.';
	};

	// ─────────────────────────────────────────────
	// Source code examples for the collapsible section
	// ─────────────────────────────────────────────
	const stateSourceCode = `const sourceData = {
  firstName: 'Alice',
  lastName: 'Smith',
  email: 'alice.smith@example.com',
  phone: '',
  bio: ''
};

const { data, reset, state: { errors, hasErrors, isDirty } } = createSvState(sourceData, {
  validator: (source) => ({
    firstName: stringValidator(source.firstName, 'trim').required().minLength(2).maxLength(30).getError(),
    lastName: stringValidator(source.lastName, 'trim').required().minLength(2).maxLength(30).getError(),
    email: stringValidator(source.email, 'trim').required().email().getError(),
    phone: stringValidator(source.phone, 'trim').required().minLength(10).getError(),
    bio: stringValidator(source.bio).maxLength(200).getError()
  })
});`;

	const resetButtonCode = `<!-- Reset button only appears when form is dirty -->
{#if $isDirty}
  <button onclick={reset} type="button">
    Reset to Initial Values
  </button>
{/if}

<!-- isDirty becomes true on any change -->
<!-- reset() restores to initial snapshot and clears history -->`;
</script>

<PageLayout
	description="Demonstrates the reset() function to restore state back to its initial values."
	title="Reset Demo"
>
	{#snippet main()}
		<StatusBadges hasErrors={$hasErrors} isDirty={$isDirty} />

		<div class="space-y-4">
			<FormField
				id="firstName"
				error={$errors?.firstName}
				label="First Name"
				placeholder="Enter first name"
				bind:value={data.firstName}
			/>

			<FormField
				id="lastName"
				error={$errors?.lastName}
				label="Last Name"
				placeholder="Enter last name"
				bind:value={data.lastName}
			/>

			<FormField
				id="email"
				error={$errors?.email}
				label="Email"
				placeholder="Enter email"
				type="email"
				bind:value={data.email}
			/>

			<FormField id="phone" error={$errors?.phone} label="Phone" placeholder="555-123-4567" bind:value={data.phone} />

			<FormTextarea
				id="bio"
				error={$errors?.bio}
				label="Bio"
				placeholder="Tell us about yourself"
				required={false}
				bind:value={data.bio}
			/>
		</div>

		{#if $isDirty}
			<div class="mt-6">
				<button
					class="w-full cursor-pointer rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
					onclick={reset}
					type="button"
				>
					Reset to Initial Values
				</button>
			</div>
		{/if}
	{/snippet}

	{#snippet sidebar()}
		<DemoSidebar {data} errors={$errors} hasErrors={$hasErrors} isDirty={$isDirty} onFill={fillWithValidData} />
	{/snippet}

	{#snippet sourceCode()}
		<SourceCodeSection>
			<CodeBlock code={stateSourceCode} title="State Setup with Reset" />
			<CodeBlock code={resetButtonCode} title="Conditional Reset Button" />
		</SourceCodeSection>
	{/snippet}
</PageLayout>
