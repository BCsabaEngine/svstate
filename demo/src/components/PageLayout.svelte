<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Properties {
		title: string;
		description?: string;
		main: Snippet;
		sidebar: Snippet;
		sourceCode?: Snippet;
	}

	let { title, description, main, sidebar, sourceCode }: Properties = $props();
</script>

<div class="flex flex-col gap-4 xl:flex-row xl:gap-6">
	<div class="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
		<h5 class="mb-1 text-lg font-medium text-gray-900 sm:text-xl">{title}</h5>
		{#if description}
			<p class="mb-4 text-sm text-gray-600">{description}</p>
		{:else}
			<div class="mb-3"></div>
		{/if}
		{@render main()}
	</div>

	{@render sidebar()}
</div>

{#if sourceCode}
	{@render sourceCode()}
{/if}
