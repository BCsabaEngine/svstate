<svelte:options runes />

<script lang="ts">
	import { type AnalyticsEvent, analyticsPlugin, autosavePlugin, createSvState, stringValidator } from 'svstate';

	import CodeBlock from '$components/CodeBlock.svelte';
	import DemoSidebar from '$components/DemoSidebar.svelte';
	import FormField from '$components/FormField.svelte';
	import FormTextarea from '$components/FormTextarea.svelte';
	import PageLayout from '$components/PageLayout.svelte';
	import SourceCodeSection from '$components/SourceCodeSection.svelte';
	import StatusBadges from '$components/StatusBadges.svelte';
	import { randomId } from '$lib/utilities';

	type SaveLogEntry = { id: string; timestamp: string; data: string };
	type FlushLogEntry = { id: string; timestamp: string; eventCount: number; types: string };

	let saveLog = $state<SaveLogEntry[]>([]);
	let flushLog = $state<FlushLogEntry[]>([]);
	let bufferedCount = $state(0);

	const autosave = autosavePlugin<{ title: string; category: string; notes: string }>({
		save: async (d) => {
			await new Promise((resolve) => setTimeout(resolve, 300));
			const timestamp = new Date().toISOString().slice(11, 23);
			saveLog = [...saveLog, { id: randomId(), timestamp, data: `${d.title} (${d.category})` }];
		},
		idle: 2000,
		onlyWhenDirty: true
	});

	const analytics = analyticsPlugin<{ title: string; category: string; notes: string }>({
		onFlush: (events: AnalyticsEvent[]) => {
			const timestamp = new Date().toISOString().slice(11, 23);
			const typeCounts: Record<string, number> = {};
			for (const event of events) typeCounts[event.type] = (typeCounts[event.type] ?? 0) + 1;
			const types = Object.entries(typeCounts)
				.map(([type, count]) => `${type}:${count}`)
				.join(', ');
			flushLog = [...flushLog, { id: randomId(), timestamp, eventCount: events.length, types }];
		},
		batchSize: 10,
		flushInterval: 10_000,
		include: ['change', 'action', 'snapshot']
	});

	const {
		data,
		execute,
		reset,
		state: { errors, hasErrors, isDirty, actionInProgress }
	} = createSvState(
		{ title: '', category: 'general', notes: '' },
		{
			validator: (source) => ({
				title: stringValidator(source.title).prepare('trim').required().minLength(2).maxLength(100).getError(),
				category: '',
				notes: stringValidator(source.notes).maxLength(500).getError()
			}),
			effect: ({ snapshot, property }) => {
				const label = property.charAt(0).toUpperCase() + property.slice(1);
				snapshot(`Changed ${label}`);
			},
			action: async () => {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		},
		{ plugins: [autosave, analytics] }
	);

	const fillWithValidData = () => {
		data.title = `Article ${randomId()}`;
		data.category = 'tech';
		data.notes = 'Some interesting notes about the topic that should pass validation.';
	};

	$effect(() => {
		const timer = setInterval(() => {
			bufferedCount = analytics.eventCount();
		}, 500);
		return () => clearInterval(timer);
	});

	const setupSourceCode = `import { createSvState, autosavePlugin, analyticsPlugin } from 'svstate';

const autosave = autosavePlugin({
  save: async (data) => {
    await fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  idle: 2000,           // Save 2s after last change
  onlyWhenDirty: true   // Skip save if nothing changed
});

const analytics = analyticsPlugin({
  onFlush: (events) => {
    sendToAnalytics(events);  // Your analytics endpoint
  },
  batchSize: 10,       // Flush after 10 events
  flushInterval: 10000, // Or every 10 seconds
  include: ['change', 'action', 'snapshot']  // Filter event types
});

const { data, execute, state } = createSvState(
  initialData, actuators,
  { plugins: [autosave, analytics] }
);`;

	const apiSourceCode = `// autosavePlugin API
autosave.saveNow();   // Force immediate save
autosave.isSaving();  // Check if currently saving

// analyticsPlugin API
analytics.flush();       // Force flush buffered events
analytics.eventCount();  // Number of buffered events`;
</script>

<PageLayout
	description="Auto-save with idle timer (autosavePlugin) and batched event analytics (analyticsPlugin)."
	title="Plugin: Autosave & Analytics"
>
	{#snippet main()}
		<StatusBadges hasErrors={$hasErrors} isDirty={$isDirty} />

		<div class="mb-4 flex items-center gap-2">
			<span class="rounded bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
				{saveLog.length} Save{saveLog.length === 1 ? '' : 's'}
			</span>
			<span class="rounded bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
				{bufferedCount} Buffered Event{bufferedCount === 1 ? '' : 's'}
			</span>
			{#if autosave.isSaving()}
				<span class="rounded bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800"> Saving... </span>
			{/if}
		</div>

		<div class="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
			Auto-save triggers 2 seconds after the last change. Analytics events buffer and flush at 10 events or every 10
			seconds.
		</div>

		<div class="space-y-4">
			<FormField
				id="title"
				error={$errors?.title}
				label="Title"
				placeholder="Enter article title"
				bind:value={data.title}
			/>

			<div>
				<label class="mb-2 block text-sm font-bold text-gray-900" for="category">Category</label>
				<select
					id="category"
					class="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
					bind:value={data.category}
				>
					<option value="general">General</option>
					<option value="tech">Technology</option>
					<option value="science">Science</option>
					<option value="culture">Culture</option>
				</select>
			</div>

			<FormTextarea
				id="notes"
				error={$errors?.notes}
				label="Notes"
				placeholder="Write your notes (max 500 chars)"
				rows={4}
				bind:value={data.notes}
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
				class="flex-1 cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
				onclick={() => autosave.saveNow()}
				type="button"
			>
				Save Now
			</button>

			<button
				class="flex-1 cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
				onclick={() => analytics.flush()}
				type="button"
			>
				Flush Analytics
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
				<h6 class="mb-2 text-sm font-medium text-gray-700">Autosave Log</h6>
				{#if saveLog.length === 0}
					<p class="text-xs text-gray-500">No saves yet — edit the form and wait 2s</p>
				{:else}
					<ul class="max-h-40 space-y-1 overflow-y-auto">
						{#each saveLog as entry (entry.id)}
							<li class="flex items-center gap-2 text-xs text-gray-600">
								<span
									class="flex-shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800"
								>
									save
								</span>
								<span class="min-w-0 flex-1 truncate">{entry.data}</span>
								<span class="flex-shrink-0 font-mono text-[10px] text-gray-400">{entry.timestamp}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
				<h6 class="mb-2 text-sm font-medium text-gray-700">Analytics Buffer</h6>
				<div class="space-y-1 text-xs text-gray-600">
					<div><span class="font-medium">Buffered:</span> {bufferedCount} event{bufferedCount === 1 ? '' : 's'}</div>
					<div><span class="font-medium">Batch size:</span> 10</div>
					<div><span class="font-medium">Flush interval:</span> 10s</div>
					<div><span class="font-medium">Tracked:</span> change, action, snapshot</div>
				</div>
			</div>

			<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
				<h6 class="mb-2 text-sm font-medium text-gray-700">Flush History</h6>
				{#if flushLog.length === 0}
					<p class="text-xs text-gray-500">No flushes yet</p>
				{:else}
					<ul class="max-h-40 space-y-1 overflow-y-auto">
						{#each flushLog as entry (entry.id)}
							<li class="flex items-start gap-2 text-xs text-gray-600">
								<span
									class="mt-0.5 flex-shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-800"
								>
									flush
								</span>
								<span class="min-w-0 flex-1">
									{entry.eventCount} event{entry.eventCount === 1 ? '' : 's'} ({entry.types})
								</span>
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
			<CodeBlock code={setupSourceCode} title="autosavePlugin + analyticsPlugin Setup" />
			<CodeBlock code={apiSourceCode} title="Plugin API" />
		</SourceCodeSection>
	{/snippet}
</PageLayout>
