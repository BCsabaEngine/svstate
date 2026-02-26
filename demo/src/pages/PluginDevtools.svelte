<svelte:options runes />

<script lang="ts">
	import { type ChangeEvent, createSvState, devtoolsPlugin, stringValidator, type SvStatePlugin } from 'svstate';

	import CodeBlock from '$components/CodeBlock.svelte';
	import DemoSidebar from '$components/DemoSidebar.svelte';
	import FormField from '$components/FormField.svelte';
	import FormTextarea from '$components/FormTextarea.svelte';
	import PageLayout from '$components/PageLayout.svelte';
	import SourceCodeSection from '$components/SourceCodeSection.svelte';
	import StatusBadges from '$components/StatusBadges.svelte';
	import { randomId } from '$lib/utilities';

	type LogEntry = {
		id: string;
		type: 'change' | 'validation' | 'snapshot' | 'action' | 'rollback' | 'reset';
		message: string;
		timestamp: string;
	};

	let logEntries = $state<LogEntry[]>([]);

	const addLog = (type: LogEntry['type'], message: string) => {
		const timestamp = new Date().toISOString().slice(11, 23);
		logEntries = [...logEntries, { id: randomId(), type, message, timestamp }];
	};

	type State = { name: string; email: string; message: string };

	const logMirrorPlugin: SvStatePlugin<State> = {
		name: 'log-mirror',
		onChange(event: ChangeEvent<State>) {
			addLog('change', `${event.property}: "${event.oldValue}" → "${event.currentValue}"`);
		},
		onValidation(errors) {
			addLog('validation', errors ? 'Has errors' : 'Valid');
		},
		onSnapshot(snapshot) {
			addLog('snapshot', snapshot.title);
		},
		onAction(event) {
			if (event.phase === 'before') addLog('action', 'Action started');
			else addLog('action', event.error ? `Action failed: ${event.error.message}` : 'Action completed');
		},
		onRollback(snapshot) {
			addLog('rollback', `Rolled back to: ${snapshot.title}`);
		},
		onReset() {
			addLog('reset', 'State reset to initial');
		}
	};

	const {
		data,
		execute,
		reset,
		rollback,
		state: { errors, hasErrors, isDirty, snapshots, actionInProgress }
	} = createSvState(
		{ name: '', email: '', message: '' },
		{
			validator: (source) => ({
				name: stringValidator(source.name).prepare('trim').required().minLength(2).maxLength(50).getError(),
				email: stringValidator(source.email).prepare('trim').required().email().getError(),
				message: stringValidator(source.message).prepare('trim').required().minLength(5).getError()
			}),
			effect: ({ snapshot, property }) => {
				const label = property.charAt(0).toUpperCase() + property.slice(1);
				snapshot(`Changed ${label}`);
			},
			action: async () => {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		},
		{
			plugins: [devtoolsPlugin({ name: 'demo-devtools', enabled: true, logValidation: true }), logMirrorPlugin]
		}
	);

	const fillWithValidData = () => {
		data.name = `John Doe ${randomId()}`;
		data.email = `john.${randomId()}@example.com`;
		data.message = 'Hello, this is a test message for the devtools demo.';
	};

	const clearLog = () => {
		logEntries = [];
	};

	const badgeColors: Record<LogEntry['type'], string> = {
		change: 'bg-blue-100 text-blue-800',
		validation: 'bg-yellow-100 text-yellow-800',
		snapshot: 'bg-purple-100 text-purple-800',
		action: 'bg-green-100 text-green-800',
		rollback: 'bg-amber-100 text-amber-800',
		reset: 'bg-red-100 text-red-800'
	};

	const setupSourceCode = `import { createSvState, devtoolsPlugin } from 'svstate';

const { data, execute, reset, rollback, state } = createSvState(
  { name: '', email: '', message: '' },
  {
    validator: (source) => ({ /* ... */ }),
    effect: ({ snapshot, property }) => {
      snapshot(\`Changed \${property}\`);
    },
    action: async () => { await saveToServer(); }
  },
  {
    plugins: [
      devtoolsPlugin({
        name: 'my-form',    // Label in console
        enabled: true,       // Auto-disabled in production
        collapsed: true,     // Console groups collapsed
        logValidation: true  // Also log validation events
      })
    ]
  }
);`;

	const hooksSourceCode = `// devtoolsPlugin logs these events to the console:
// - onChange:     property changes with old/new values
// - onValidation: validation results (if logValidation: true)
// - onSnapshot:   snapshot creation with title
// - onAction:     action start/complete/error
// - onRollback:   rollback with target snapshot title
// - onReset:      state reset events`;
</script>

<PageLayout
	description="Shows devtoolsPlugin console logging and a custom log-mirror plugin that captures all events in-page."
	title="Plugin: Devtools"
>
	{#snippet main()}
		<StatusBadges hasErrors={$hasErrors} isDirty={$isDirty} />

		<div class="space-y-4">
			<FormField id="name" error={$errors?.name} label="Name" placeholder="Enter your name" bind:value={data.name} />

			<FormField
				id="email"
				error={$errors?.email}
				label="Email"
				placeholder="Enter your email"
				type="email"
				bind:value={data.email}
			/>

			<FormTextarea
				id="message"
				error={$errors?.message}
				label="Message"
				placeholder="Enter a message (min 5 chars)"
				required={true}
				bind:value={data.message}
			/>
		</div>

		<div class="mt-6 flex flex-wrap gap-3">
			<button
				class="flex-1 cursor-pointer rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={$hasErrors || $actionInProgress}
				onclick={() => execute()}
				type="button"
			>
				{$actionInProgress ? 'Submitting...' : 'Submit'}
			</button>

			<button
				class="flex-1 cursor-pointer rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
				disabled={$snapshots.length <= 1}
				onclick={() => rollback()}
				type="button"
			>
				Undo
			</button>

			{#if $isDirty}
				<button
					class="flex-1 cursor-pointer rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
					onclick={reset}
					type="button"
				>
					Reset
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
				<div class="mb-2 flex items-center justify-between">
					<h6 class="text-sm font-medium text-gray-700">Event Log</h6>
					<button class="cursor-pointer text-xs text-gray-500 hover:text-gray-700" onclick={clearLog} type="button">
						Clear
					</button>
				</div>
				{#if logEntries.length === 0}
					<p class="text-xs text-gray-500">No events yet — interact with the form</p>
				{:else}
					<ul class="max-h-64 space-y-1 overflow-y-auto">
						{#each logEntries as entry (entry.id)}
							<li class="flex items-start gap-2 text-xs text-gray-600">
								<span
									class="mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium {badgeColors[entry.type]}"
								>
									{entry.type}
								</span>
								<span class="min-w-0 flex-1 break-words">{entry.message}</span>
								<span class="flex-shrink-0 font-mono text-[10px] text-gray-400">{entry.timestamp}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	{/snippet}

	{#snippet sourceCode()}
		<SourceCodeSection>
			<CodeBlock code={setupSourceCode} title="devtoolsPlugin Setup" />
			<CodeBlock code={hooksSourceCode} title="What Gets Logged" />
		</SourceCodeSection>
	{/snippet}
</PageLayout>
