<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Properties {
		title: string;
		subtitle?: string;
		isDirty?: boolean;
		children: Snippet;
	}

	let { title, subtitle, isDirty, children }: Properties = $props();
</script>

<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
	<h6 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
		{title}
		{#if subtitle}
			<span class="font-normal normal-case">({subtitle})</span>
		{/if}
		{#if isDirty}
			<span class="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-400" title="Modified"></span>
		{/if}
	</h6>
	{@render children()}
</div>
