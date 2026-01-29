<svelte:options runes />

<script lang="ts">
	import { createSvState, numberValidator, stringValidator } from 'svstate';

	import CodeBlock from '$components/CodeBlock.svelte';
	import DemoSidebar from '$components/DemoSidebar.svelte';
	import FormField from '$components/FormField.svelte';
	import FormTextarea from '$components/FormTextarea.svelte';
	import PageLayout from '$components/PageLayout.svelte';
	import SourceCodeSection from '$components/SourceCodeSection.svelte';
	import StatusBadges from '$components/StatusBadges.svelte';
	import { randomId, randomInt } from '$lib/utilities';

	const sourceData = {
		username: '',
		email: '',
		age: 0,
		bio: '',
		website: ''
	};

	const {
		data,
		state: { errors, hasErrors, isDirty }
	} = createSvState(sourceData, {
		validator: (source) => ({
			username: stringValidator(source.username)
				.prepare('trim')
				.required()
				.minLength(3)
				.maxLength(20)
				.noSpace()
				.getError(),
			email: stringValidator(source.email).prepare('trim').required().email().getError(),
			age: numberValidator(source.age).required().min(18).max(120).integer().getError(),
			bio: stringValidator(source.bio).maxLength(200).getError(),
			website: stringValidator(source.website).prepare('trim').website('required').getError()
		})
	});

	const fillWithValidData = () => {
		data.username = `user${randomId()}`;
		data.email = `${randomId()}@example.com`;
		data.age = randomInt(18, 65);
		data.bio = 'Hello, I am a demo user!';
		data.website = `https://${randomId()}.com`;
	};

	// ─────────────────────────────────────────────
	// Source code examples for the collapsible section
	// ─────────────────────────────────────────────
	const stateSourceCode = `const sourceData = {
  username: '',
  email: '',
  age: 0,
  bio: '',
  website: ''
};

const { data, state: { errors, hasErrors, isDirty } } = createSvState(sourceData, {
  validator: (source) => ({
    username: stringValidator(source.username).prepare('trim').required().minLength(3).maxLength(20).noSpace().getError(),
    email: stringValidator(source.email).prepare('trim').required().email().getError(),
    age: numberValidator(source.age).required().min(18).max(120).integer().getError(),
    bio: stringValidator(source.bio).maxLength(200).getError(),
    website: stringValidator(source.website).prepare('trim').website('required').getError()
  })
});`;

	const formSourceCode = `<input
  id="username"
  type="text"
  placeholder="Enter username"
  class="... {$errors?.username ? 'error-styles' : 'normal-styles'}"
  bind:value={data.username}
/>
<ErrorText error={$errors?.username ?? ''} />`;
</script>

<PageLayout
	description="Demonstrates form validation with string, number, and email validators using the fluent API."
	title="Basic Validation Demo"
>
	{#snippet main()}
		<StatusBadges hasErrors={$hasErrors} isDirty={$isDirty} />

		<div class="space-y-4">
			<FormField
				id="username"
				error={$errors?.username}
				label="Username"
				placeholder="Enter username"
				bind:value={data.username}
			/>

			<FormField
				id="email"
				error={$errors?.email}
				label="Email"
				placeholder="Enter email"
				type="email"
				bind:value={data.email}
			/>

			<FormField
				id="age"
				error={$errors?.age}
				label="Age"
				placeholder="Enter age"
				type="number"
				bind:value={data.age}
			/>

			<FormTextarea
				id="bio"
				error={$errors?.bio}
				label="Bio"
				placeholder="Tell us about yourself"
				bind:value={data.bio}
			/>

			<FormField
				id="website"
				error={$errors?.website}
				label="Website"
				placeholder="https://example.com"
				required={false}
				bind:value={data.website}
			/>
		</div>
	{/snippet}

	{#snippet sidebar()}
		<DemoSidebar {data} errors={$errors} hasErrors={$hasErrors} isDirty={$isDirty} onFill={fillWithValidData} />
	{/snippet}

	{#snippet sourceCode()}
		<SourceCodeSection>
			<CodeBlock code={stateSourceCode} title="State Setup" />
			<CodeBlock code={formSourceCode} title="Form Binding Example" />
		</SourceCodeSection>
	{/snippet}
</PageLayout>
