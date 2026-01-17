<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Properties {
		title: string;
		main: Snippet;
		sidebar: Snippet;
		sourceCode?: Snippet;
	}

	let { title, main, sidebar, sourceCode }: Properties = $props();
</script>

<div class="flex gap-6">
	<div class="max-w-xl flex-1 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<h5 class="mb-4 text-xl font-medium text-gray-900">{title}</h5>
		{@render main()}
	</div>

	{@render sidebar()}
</div>

{#if sourceCode}
	{@render sourceCode()}
{/if}
