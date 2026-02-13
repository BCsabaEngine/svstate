<svelte:options runes />

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

	const formatFieldName = (property: string) => {
		return property.charAt(0).toUpperCase() + property.slice(1).replaceAll(/([A-Z])/g, ' $1');
	};

	const {
		data,
		reset,
		rollback,
		rollbackTo,
		state: { errors, hasErrors, isDirty, snapshots }
	} = createSvState(
		sourceData,
		{
			validator: (source) => ({
				firstName: stringValidator(source.firstName).prepare('trim').required().minLength(2).maxLength(30).getError(),
				lastName: stringValidator(source.lastName).prepare('trim').required().minLength(2).maxLength(30).getError(),
				email: stringValidator(source.email).prepare('trim').required().email().getError(),
				phone: stringValidator(source.phone).prepare('trim').required().minLength(10).getError(),
				bio: stringValidator(source.bio).maxLength(200).getError()
			}),
			effect: ({ snapshot, property }) => {
				snapshot(`Changed ${formatFieldName(property)}`);
			}
		},
		{ maxSnapshots: 5 }
	);

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
  firstName: 'Alice', lastName: 'Smith', email: 'alice.smith@example.com', phone: '', bio: ''
};

const { data, reset, rollback, rollbackTo, state: { errors, hasErrors, isDirty, snapshots } } =
  createSvState(sourceData, {
    validator: (source) => ({ /* validation rules */ }),
    effect: ({ snapshot, property }) => {
      snapshot(\`Changed \${formatFieldName(property)}\`);
    }
  }, { maxSnapshots: 5 });`;

	const effectSourceCode = `// Effect callback creates snapshots on each change
effect: ({ snapshot, property }) => {
  snapshot(\`Changed \${property}\`);  // Creates undo point
  // If same title, replaces last snapshot (debouncing)
  // Use snapshot(title, false) to always create new
}`;

	const rollbackSourceCode = `// Undo last change
rollback();

// Undo 3 changes at once
rollback(3);

// Roll back to a named snapshot (returns true if found)
rollbackTo('Changed First Name');

// Roll back to initial state
rollbackTo('Initial');

// Reset to initial state (clears all snapshots)
reset();`;
</script>

<PageLayout
	description="Shows snapshot creation for undo functionality with rollback(), rollbackTo(), and maxSnapshots support."
	title="Snapshot & Rollback Demo"
>
	{#snippet main()}
		<StatusBadges hasErrors={$hasErrors} isDirty={$isDirty} />

		<div class="mb-4 flex items-center gap-2">
			<span class="rounded bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
				{$snapshots.length} Snapshot{$snapshots.length === 1 ? '' : 's'}
			</span>
			<span class="rounded bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
				Max: 5
			</span>
		</div>

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

		<div class="mt-6 flex flex-wrap gap-3">
			<button
				class="flex-1 cursor-pointer rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={$snapshots.length <= 1}
				onclick={() => rollback()}
				type="button"
			>
				Undo Last Change
			</button>

			<button
				class="flex-1 cursor-pointer rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={$snapshots.length <= 1}
				onclick={() => rollbackTo('Initial')}
				type="button"
			>
				Rollback To Initial
			</button>

			{#if $isDirty}
				<button
					class="flex-1 cursor-pointer rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
					onclick={reset}
					type="button"
				>
					Reset All
				</button>
			{/if}
		</div>
	{/snippet}

	{#snippet sidebar()}
		<div class="w-full flex-shrink-0 space-y-4 xl:w-96">
			<DemoSidebar
				{data}
				errors={$errors}
				hasErrors={$hasErrors}
				isDirty={$isDirty}
				onFill={fillWithValidData}
				width="xl:w-96"
			/>

			<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
				<h6 class="mb-2 text-sm font-medium text-gray-700">Snapshot History</h6>
				{#if $snapshots.length === 0}
					<p class="text-xs text-gray-500">No snapshots yet</p>
				{:else}
					<ul class="max-h-48 space-y-1 overflow-y-auto">
						{#each $snapshots as snap, index}
							<li class="flex items-center gap-2 text-xs text-gray-600">
								<span
									class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-200 text-xs font-medium text-purple-800"
								>
									{index + 1}
								</span>
								<button
									class="cursor-pointer truncate hover:text-purple-700 hover:underline disabled:cursor-default disabled:no-underline disabled:hover:text-gray-600"
									disabled={$snapshots.length <= 1}
									onclick={() => rollbackTo(snap.title)}
									type="button"
								>
									{snap.title}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	{/snippet}

	{#snippet sourceCode()}
		<SourceCodeSection>
			<CodeBlock code={stateSourceCode} title="State Setup with Snapshots & maxSnapshots" />
			<CodeBlock code={effectSourceCode} title="Effect with Snapshot Creation" />
			<CodeBlock code={rollbackSourceCode} title="Rollback, RollbackTo & Reset Usage" />
		</SourceCodeSection>
	{/snippet}
</PageLayout>
