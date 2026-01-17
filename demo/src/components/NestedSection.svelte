<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Properties {
		title: string;
		subtitle?: string;
		children: Snippet;
	}

	let { title, subtitle, children }: Properties = $props();
</script>

<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
	<h6 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
		{title}
		{#if subtitle}
			<span class="font-normal normal-case">({subtitle})</span>
		{/if}
	</h6>
	{@render children()}
</div>
