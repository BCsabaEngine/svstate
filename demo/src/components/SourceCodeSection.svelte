<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Properties {
		children: Snippet;
	}

	let { children }: Properties = $props();
	let showSourceCode = $state(false);
</script>

<div class="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm">
	<button
		class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-50 {showSourceCode
			? 'border-b border-gray-200'
			: ''}"
		onclick={() => (showSourceCode = !showSourceCode)}
		type="button"
	>
		<span>Source Code</span>
		<svg
			class="h-5 w-5 transform transition-transform {showSourceCode ? 'rotate-180' : ''}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
		</svg>
	</button>

	{#if showSourceCode}
		<div class="space-y-4 p-4">
			{@render children()}
		</div>
	{/if}
</div>
