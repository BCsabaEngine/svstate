<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Properties {
		index: number;
		label?: string;
		onRemove: () => void;
		children: Snippet;
	}

	let { index, label = 'Item', onRemove, children }: Properties = $props();
</script>

<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
	<div class="mb-3 flex items-center justify-between">
		<span class="text-xs font-medium text-gray-500">{label} #{index + 1}</span>
		<button
			class="cursor-pointer rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
			onclick={onRemove}
			type="button"
		>
			Remove
		</button>
	</div>
	{@render children()}
</div>
