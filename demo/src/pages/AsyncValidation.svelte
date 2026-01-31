<script lang="ts">
	import { createSvState, stringValidator } from 'svstate';

	import CodeBlock from '$components/CodeBlock.svelte';
	import DemoSidebar from '$components/DemoSidebar.svelte';
	import FormField from '$components/FormField.svelte';
	import PageLayout from '$components/PageLayout.svelte';
	import SourceCodeSection from '$components/SourceCodeSection.svelte';
	import StatusBadges from '$components/StatusBadges.svelte';
	import { randomId } from '$lib/utilities';

	// Simulated taken usernames, emails, and slugs
	const takenUsernames = ['admin', 'user', 'test', 'demo', 'root'];
	const takenEmails = ['admin@example.com', 'test@example.com', 'user@example.com'];
	const takenSlugs = ['admin', 'about', 'contact', 'help', 'support'];

	const sourceData = {
		username: '',
		email: '',
		slug: ''
	};

	const {
		data,
		state: { errors, hasErrors, isDirty, asyncErrors, hasAsyncErrors, asyncValidating, hasCombinedErrors }
	} = createSvState(
		sourceData,
		{
			validator: (source) => ({
				username: stringValidator(source.username)
					.prepare('trim')
					.required()
					.minLength(3)
					.maxLength(20)
					.noSpace()
					.getError(),
				email: stringValidator(source.email).prepare('trim').required().email().getError(),
				slug: stringValidator(source.slug).prepare('trim').required().minLength(2).slug().getError()
			}),
			asyncValidator: {
				username: async (value, _source, signal) => {
					// Simulate API delay (500ms)
					await new Promise((resolve, reject) => {
						const timeout = setTimeout(resolve, 500);
						signal.addEventListener('abort', () => {
							clearTimeout(timeout);
							reject(new DOMException('Aborted', 'AbortError'));
						});
					});

					const username = String(value).toLowerCase();
					return takenUsernames.includes(username) ? 'Username is already taken' : '';
				},
				email: async (value, _source, signal) => {
					// Simulate API delay (400ms)
					await new Promise((resolve, reject) => {
						const timeout = setTimeout(resolve, 400);
						signal.addEventListener('abort', () => {
							clearTimeout(timeout);
							reject(new DOMException('Aborted', 'AbortError'));
						});
					});

					const email = String(value).toLowerCase();
					return takenEmails.includes(email) ? 'Email is already registered' : '';
				},
				slug: async (value, _source, signal) => {
					// Simulate API delay (600ms)
					await new Promise((resolve, reject) => {
						const timeout = setTimeout(resolve, 600);
						signal.addEventListener('abort', () => {
							clearTimeout(timeout);
							reject(new DOMException('Aborted', 'AbortError'));
						});
					});

					const slug = String(value).toLowerCase();
					return takenSlugs.includes(slug) ? 'URL slug is already in use' : '';
				}
			}
		},
		{ maxConcurrentAsyncValidations: 2 }
	);

	const fillWithValidData = () => {
		data.username = `newuser${randomId()}`;
		data.email = `${randomId()}@example.com`;
		data.slug = `my-page-${randomId()}`;
	};

	const fillWithTakenData = () => {
		data.username = 'admin';
		data.email = 'admin@example.com';
		data.slug = 'about';
	};

	// ─────────────────────────────────────────────
	// Source code examples for the collapsible section
	// ─────────────────────────────────────────────
	const stateSourceCode = `const { data, state: { errors, asyncErrors, asyncValidating, hasCombinedErrors } } =
  createSvState(sourceData, {
    validator: (source) => ({
      username: stringValidator(source.username).required().minLength(3).noSpace().getError(),
      email: stringValidator(source.email).required().email().getError(),
      slug: stringValidator(source.slug).required().minLength(2).slug().getError()
    }),
    asyncValidator: {
      username: async (value, source, signal) => {
        const res = await fetch(\`/api/check-username?u=\${value}\`, { signal });
        return (await res.json()).available ? '' : 'Username already taken';
      },
      email: async (value, source, signal) => {
        const res = await fetch(\`/api/check-email?e=\${value}\`, { signal });
        return (await res.json()).available ? '' : 'Email already registered';
      },
      slug: async (value, source, signal) => {
        const res = await fetch(\`/api/check-slug?s=\${value}\`, { signal });
        return (await res.json()).available ? '' : 'URL slug already in use';
      }
    }
  },
  { maxConcurrentAsyncValidations: 2 } // Only 2 async validations run at a time
);`;

	const templateSourceCode = `<!-- Show loading spinner when validating -->
{#if $asyncValidating.includes('username')}
  <span class="animate-spin">...</span>
{/if}

<!-- Show async error -->
{#if $asyncErrors.username}
  <span class="text-red-500">{$asyncErrors.username}</span>
{/if}

<!-- Disable submit when any errors -->
<button disabled={$hasCombinedErrors}>Submit</button>`;

	const storesSourceCode = `// Available stores for async validation:
$errors          // Sync validation errors (nested object)
$hasErrors       // true if any sync errors

$asyncErrors     // Async validation errors (flat map by path)
$hasAsyncErrors  // true if any async errors

$asyncValidating // Array of paths currently being validated
$hasCombinedErrors // hasErrors || hasAsyncErrors`;
</script>

<PageLayout
	description="Demonstrates async validation with simulated API calls for username and email uniqueness checks."
	title="Async Validation Demo"
>
	{#snippet main()}
		<StatusBadges hasErrors={$hasErrors} isDirty={$isDirty} />

		<div class="mb-4 flex flex-wrap items-center gap-2">
			<span
				class="rounded px-2.5 py-0.5 text-xs font-medium {$hasAsyncErrors
					? 'bg-red-100 text-red-800'
					: 'bg-gray-100 text-gray-800'}"
			>
				Async Errors: {$hasAsyncErrors ? 'Yes' : 'No'}
			</span>
			<span
				class="rounded px-2.5 py-0.5 text-xs font-medium {$hasCombinedErrors
					? 'bg-red-100 text-red-800'
					: 'bg-green-100 text-green-800'}"
			>
				Combined: {$hasCombinedErrors ? 'Has Errors' : 'Valid'}
			</span>
		</div>

		<div class="space-y-4">
			<div class="relative">
				<FormField
					id="username"
					error={$errors?.username || $asyncErrors.username}
					label="Username"
					placeholder="Enter username (try 'admin', 'user', 'test')"
					bind:value={data.username}
				/>
				{#if $asyncValidating.includes('username')}
					<div class="absolute right-3 top-9">
						<svg class="h-5 w-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path
								class="opacity-75"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								fill="currentColor"
							></path>
						</svg>
					</div>
				{/if}
			</div>

			<div class="relative">
				<FormField
					id="email"
					error={$errors?.email || $asyncErrors.email}
					label="Email"
					placeholder="Enter email (try 'admin@example.com')"
					type="email"
					bind:value={data.email}
				/>
				{#if $asyncValidating.includes('email')}
					<div class="absolute right-3 top-9">
						<svg class="h-5 w-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path
								class="opacity-75"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								fill="currentColor"
							></path>
						</svg>
					</div>
				{/if}
			</div>

			<div class="relative">
				<FormField
					id="slug"
					error={$errors?.slug || $asyncErrors.slug}
					label="URL Slug"
					placeholder="Enter slug (try 'admin', 'about', 'contact')"
					bind:value={data.slug}
				/>
				{#if $asyncValidating.includes('slug')}
					<div class="absolute right-3 top-9">
						<svg class="h-5 w-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path
								class="opacity-75"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								fill="currentColor"
							></path>
						</svg>
					</div>
				{/if}
			</div>
		</div>

		<div class="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
			<div class="text-sm text-blue-800">
				<span class="font-medium">Taken usernames:</span>
				{takenUsernames.join(', ')}
			</div>
			<div class="mt-1 text-sm text-blue-800">
				<span class="font-medium">Taken emails:</span>
				{takenEmails.join(', ')}
			</div>
			<div class="mt-1 text-sm text-blue-800">
				<span class="font-medium">Taken slugs:</span>
				{takenSlugs.join(', ')}
			</div>
		</div>

		<div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
			<div class="text-sm text-amber-800">
				<span class="font-medium">Concurrency limit:</span> maxConcurrentAsyncValidations = 2
			</div>
			<div class="mt-1 text-xs text-amber-700">
				Only 2 async validations run simultaneously. Try filling all 3 fields at once to see queuing in action.
			</div>
		</div>

		<div class="mt-6 flex gap-2">
			<button
				class="flex-1 cursor-pointer rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={$hasCombinedErrors || $asyncValidating.length > 0}
				type="button"
			>
				{#if $asyncValidating.length > 0}
					<span class="inline-flex items-center gap-2">
						<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path
								class="opacity-75"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								fill="currentColor"
							></path>
						</svg>
						Validating...
					</span>
				{:else}
					Submit
				{/if}
			</button>
		</div>
	{/snippet}

	{#snippet sidebar()}
		<div class="w-full flex-shrink-0 space-y-4 xl:w-80">
			<DemoSidebar {data} errors={$errors} hasErrors={$hasErrors} isDirty={$isDirty} onFill={fillWithValidData} />

			<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
				<h6 class="mb-2 text-sm font-medium text-gray-700">Quick Fill</h6>
				<button
					class="w-full cursor-pointer rounded bg-orange-100 px-3 py-1.5 text-sm text-orange-800 hover:bg-orange-200"
					onclick={fillWithTakenData}
					type="button"
				>
					Fill with taken values
				</button>
			</div>

			<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
				<h6 class="mb-2 text-sm font-medium text-gray-700">Async Validation State</h6>
				<div class="space-y-1 text-xs text-gray-600">
					<div><span class="font-medium">asyncValidating:</span> [{$asyncValidating.join(', ')}]</div>
					<div><span class="font-medium">hasAsyncErrors:</span> {$hasAsyncErrors}</div>
					<div><span class="font-medium">hasCombinedErrors:</span> {$hasCombinedErrors}</div>
				</div>
			</div>

			<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
				<h6 class="mb-2 text-sm font-medium text-gray-700">Async Errors</h6>
				<pre class="overflow-auto text-xs text-gray-600">{JSON.stringify($asyncErrors, undefined, 2)}</pre>
			</div>
		</div>
	{/snippet}

	{#snippet sourceCode()}
		<SourceCodeSection>
			<CodeBlock code={stateSourceCode} title="State Setup with Async Validators" />
			<CodeBlock code={templateSourceCode} title="Template Usage" />
			<CodeBlock code={storesSourceCode} title="Available Stores" />
		</SourceCodeSection>
	{/snippet}
</PageLayout>
