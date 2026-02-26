<svelte:options runes />

<script lang="ts">
	import { createSvState, persistPlugin, stringValidator, syncPlugin } from 'svstate';

	import CodeBlock from '$components/CodeBlock.svelte';
	import DemoSidebar from '$components/DemoSidebar.svelte';
	import FormField from '$components/FormField.svelte';
	import PageLayout from '$components/PageLayout.svelte';
	import SourceCodeSection from '$components/SourceCodeSection.svelte';
	import StatusBadges from '$components/StatusBadges.svelte';

	type Settings = {
		username: string;
		theme: string;
		fontSize: number;
		notifications: boolean;
	};

	const persist = persistPlugin<Settings>({
		key: 'svstate-demo-settings',
		throttle: 300,
		exclude: ['notifications']
	});

	const sync = syncPlugin<Settings>({
		key: 'svstate-demo-sync',
		throttle: 200
	});

	const {
		data,
		reset,
		state: { errors, hasErrors, isDirty }
	} = createSvState(
		{ username: '', theme: 'light', fontSize: 14, notifications: true },
		{
			validator: (source) => ({
				username: stringValidator(source.username).prepare('trim').required().minLength(2).maxLength(30).getError(),
				theme: '',
				fontSize: '',
				notifications: ''
			})
		},
		{ plugins: [persist, sync] }
	);

	const isRestored = persist.isRestored();

	const clearStorage = () => {
		persist.clearPersistedState();
		reset();
	};

	const fillWithValidData = () => {
		data.username = 'demo_user';
		data.theme = 'dark';
		data.fontSize = 16;
		data.notifications = false;
	};

	let storedJson = $state('');

	$effect(() => {
		// Re-read on any data change
		void data.username;
		void data.theme;
		void data.fontSize;
		void data.notifications;

		const timer = setTimeout(() => {
			storedJson = localStorage.getItem('svstate-demo-settings') ?? '(empty)';
		}, 500);
		return () => clearTimeout(timer);
	});

	const setupSourceCode = `import { createSvState, persistPlugin, syncPlugin } from 'svstate';

const persist = persistPlugin({
  key: 'svstate-demo-settings',
  throttle: 300,
  exclude: ['notifications']  // Don't persist this field
});

const sync = syncPlugin({
  key: 'svstate-demo-sync',
  throttle: 200
});

const { data, reset, state } = createSvState(
  { username: '', theme: 'light', fontSize: 14, notifications: true },
  { validator: (source) => ({ /* ... */ }) },
  { plugins: [persist, sync] }
);`;

	const apiSourceCode = `// persistPlugin API
persist.isRestored();        // true if data was loaded from storage
persist.clearPersistedState(); // Remove stored data

// syncPlugin: automatic cross-tab sync via BroadcastChannel
// Changes in one tab appear in all other tabs with same key`;
</script>

<PageLayout
	description="Settings form with persistPlugin (localStorage) and syncPlugin (cross-tab sync via BroadcastChannel)."
	title="Plugin: Persist & Sync"
>
	{#snippet main()}
		<StatusBadges hasErrors={$hasErrors} isDirty={$isDirty} />

		<div class="mb-4 flex items-center gap-2">
			{#if isRestored}
				<span class="rounded bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
					Restored from storage
				</span>
			{:else}
				<span class="rounded bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800"> Fresh state </span>
			{/if}
		</div>

		<div class="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
			Try: Reload the page to see persistence. Open this page in another tab to see cross-tab sync.
		</div>

		<div class="space-y-4">
			<FormField
				id="username"
				error={$errors?.username}
				label="Username"
				placeholder="Enter username"
				bind:value={data.username}
			/>

			<div>
				<label class="mb-2 block text-sm font-bold text-gray-900" for="theme">Theme</label>
				<select
					id="theme"
					class="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
					bind:value={data.theme}
				>
					<option value="light">Light</option>
					<option value="dark">Dark</option>
					<option value="system">System</option>
				</select>
			</div>

			<FormField id="fontSize" label="Font Size" max={32} min={8} step={1} type="number" bind:value={data.fontSize} />

			<div>
				<label class="flex items-center gap-2 text-sm text-gray-900">
					<input
						class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
						type="checkbox"
						bind:checked={data.notifications}
					/>
					<span>Enable notifications</span>
					<span class="text-xs text-gray-500">(not persisted)</span>
				</label>
			</div>
		</div>

		<div class="mt-6 flex flex-wrap gap-3">
			<button
				class="flex-1 cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
				onclick={clearStorage}
				type="button"
			>
				Clear Storage & Reset
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
				<h6 class="mb-2 text-sm font-medium text-gray-700">Persistence Info</h6>
				<div class="space-y-1 text-xs text-gray-600">
					<div><span class="font-medium">Restored:</span> {isRestored}</div>
					<div><span class="font-medium">Key:</span> svstate-demo-settings</div>
					<div><span class="font-medium">Excluded:</span> notifications</div>
				</div>
			</div>

			<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
				<h6 class="mb-2 text-sm font-medium text-gray-700">Raw localStorage</h6>
				<pre class="max-h-32 overflow-auto text-xs text-gray-600">{storedJson}</pre>
			</div>

			<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
				<h6 class="mb-2 text-sm font-medium text-gray-700">Sync Info</h6>
				<div class="space-y-1 text-xs text-gray-600">
					<div><span class="font-medium">Channel:</span> svstate-demo-sync</div>
					<div><span class="font-medium">Throttle:</span> 200ms</div>
					<div><span class="font-medium">Merge:</span> overwrite (default)</div>
				</div>
			</div>
		</div>
	{/snippet}

	{#snippet sourceCode()}
		<SourceCodeSection>
			<CodeBlock code={setupSourceCode} title="persistPlugin + syncPlugin Setup" />
			<CodeBlock code={apiSourceCode} title="Plugin API" />
		</SourceCodeSection>
	{/snippet}
</PageLayout>
