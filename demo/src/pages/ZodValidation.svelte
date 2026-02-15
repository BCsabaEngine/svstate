<svelte:options runes />

<script lang="ts">
	import { createSvState } from 'svstate';
	import { z } from 'zod';

	import CodeBlock from '$components/CodeBlock.svelte';
	import DemoSidebar from '$components/DemoSidebar.svelte';
	import FormField from '$components/FormField.svelte';
	import FormTextarea from '$components/FormTextarea.svelte';
	import PageLayout from '$components/PageLayout.svelte';
	import SourceCodeSection from '$components/SourceCodeSection.svelte';
	import StatusBadges from '$components/StatusBadges.svelte';
	import { randomId, randomInt } from '$lib/utilities';

	// ─────────────────────────────────────────────
	// Zod schema definition
	// ─────────────────────────────────────────────
	const userSchema = z.object({
		username: z.string().min(3).max(20).regex(/^\S+$/, 'Must not contain spaces'),
		email: z.string().min(1, 'Required').email(),
		age: z.number().int().min(18).max(120),
		website: z.string().url().optional().or(z.literal('')),
		bio: z.string().max(200).optional()
	});

	type UserForm = z.infer<typeof userSchema>;

	// ─────────────────────────────────────────────
	// Bridge: Zod errors → svstate Record<string, string>
	// ─────────────────────────────────────────────
	function zodToSvstateErrors<T extends z.ZodObject>(
		schema: T,
		source: unknown,
		fields: string[]
	): Record<string, string> {
		const result = schema.safeParse(source);
		if (result.success) return Object.fromEntries(fields.map((f) => [f, '']));

		const errorMap: Record<string, string> = {};
		for (const issue of result.error.issues) {
			const key = String(issue.path[0]);
			if (!errorMap[key]) errorMap[key] = issue.message;
		}

		return Object.fromEntries(fields.map((f) => [f, errorMap[f] ?? '']));
	}

	// ─────────────────────────────────────────────
	// Dynamic rendering via z.pick()
	// ─────────────────────────────────────────────
	const pickedSchema = userSchema.pick({ username: true, email: true, age: true, website: true });
	const dynamicFields = Object.keys(pickedSchema.shape) as (keyof UserForm)[];
	const allFields = [...dynamicFields, 'bio'] as string[];

	const fieldMeta: Record<string, { label: string; placeholder: string; type: 'text' | 'email' | 'number' }> = {
		username: { label: 'Username', placeholder: 'Enter username', type: 'text' },
		email: { label: 'Email', placeholder: 'Enter email', type: 'email' },
		age: { label: 'Age', placeholder: 'Enter age', type: 'number' },
		website: { label: 'Website', placeholder: 'https://example.com', type: 'text' }
	};

	// ─────────────────────────────────────────────
	// svstate setup
	// ─────────────────────────────────────────────
	const sourceData: UserForm = {
		username: '',
		email: '',
		age: 0,
		website: '',
		bio: ''
	};

	const {
		data,
		state: { errors, hasErrors, isDirty, isDirtyByField }
	} = createSvState(sourceData, {
		validator: (source) => zodToSvstateErrors(userSchema, source, allFields)
	});

	const fillWithValidData = () => {
		data.username = `user${randomId()}`;
		data.email = `${randomId()}@example.com`;
		data.age = randomInt(18, 65);
		data.bio = 'Hello, I am a demo user!';
		data.website = `https://${randomId()}.com`;
	};

	// ─────────────────────────────────────────────
	// Source code examples
	// ─────────────────────────────────────────────
	const schemaSourceCode = String.raw`import { z } from 'zod';

const userSchema = z.object({
  username: z.string().min(3).max(20).regex(/^\S+$/, 'Must not contain spaces'),
  email: z.string().min(1, 'Required').email(),
  age: z.number().int().min(18).max(120),
  website: z.string().url().optional().or(z.literal('')),
  bio: z.string().max(200).optional()
});`;

	const bridgeSourceCode = `function zodToSvstateErrors(schema, source, fields) {
  const result = schema.safeParse(source);
  if (result.success)
    return Object.fromEntries(fields.map(f => [f, '']));

  const errorMap = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0]);
    if (!errorMap[key]) errorMap[key] = issue.message;
  }
  return Object.fromEntries(
    fields.map(f => [f, errorMap[f] ?? ''])
  );
}

const { data, state: { errors, hasErrors } } = createSvState(sourceData, {
  validator: (source) => zodToSvstateErrors(userSchema, source, allFields)
});`;

	const dynamicSourceCode = `// Pick a subset of fields for dynamic rendering
const pickedSchema = userSchema.pick({ username: true, email: true, age: true, website: true });
const dynamicFields = Object.keys(pickedSchema.shape);

const fieldMeta = {
  username: { label: 'Username', placeholder: 'Enter username', type: 'text' },
  email:    { label: 'Email',    placeholder: 'Enter email',    type: 'email' },
  age:      { label: 'Age',      placeholder: 'Enter age',      type: 'number' },
  website:  { label: 'Website',  placeholder: 'https://...',    type: 'text' },
};

// In template:
{#each dynamicFields as field}
  <FormField
    id={field}
    label={fieldMeta[field].label}
    type={fieldMeta[field].type}
    placeholder={fieldMeta[field].placeholder}
    error={$errors?.[field]}
    bind:value={data[field]}
  />
{/each}

<!-- bio rendered separately (not in pick) -->
<FormTextarea id="bio" ... bind:value={data.bio} />`;
</script>

<PageLayout
	description="Demonstrates using Zod schemas for validation with svstate, including dynamic form rendering via z.pick() shape keys."
	title="Zod Integration Demo"
>
	{#snippet main()}
		<StatusBadges hasErrors={$hasErrors} isDirty={$isDirty} />

		<div class="space-y-4">
			{#each dynamicFields as field (field)}
				{@const meta = fieldMeta[field]}
				<FormField
					id={field}
					error={($errors as Record<string, string>)?.[field]}
					isDirty={$isDirtyByField[field]}
					label={meta.label}
					placeholder={meta.placeholder}
					required={field !== 'website'}
					type={meta.type}
					bind:value={data[field] as string | number}
				/>
			{/each}

			<FormTextarea
				id="bio"
				error={($errors as Record<string, string>)?.bio}
				isDirty={$isDirtyByField['bio']}
				label="Bio"
				placeholder="Tell us about yourself (not in pick subset)"
				bind:value={data.bio as string}
			/>
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
		/>
	{/snippet}

	{#snippet sourceCode()}
		<SourceCodeSection>
			<CodeBlock code={schemaSourceCode} title="Zod Schema Definition" />
			<CodeBlock code={bridgeSourceCode} title="Bridge Function (Zod → svstate)" />
			<CodeBlock code={dynamicSourceCode} title="Dynamic Rendering via z.pick()" />
		</SourceCodeSection>
	{/snippet}
</PageLayout>
