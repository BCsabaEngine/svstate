<script lang="ts">
	interface Properties {
		hasErrors: boolean;
		isDirty: boolean;
	}

	let { hasErrors, isDirty }: Properties = $props();
</script>

<div class="mb-4 flex gap-2">
	<span
		class="rounded px-2.5 py-0.5 text-xs font-medium {hasErrors
			? 'bg-red-100 text-red-800'
			: 'bg-green-100 text-green-800'}"
	>
		{hasErrors ? 'Has Errors' : 'Valid'}
	</span>
	<span
		class="rounded px-2.5 py-0.5 text-xs font-medium {isDirty
			? 'bg-yellow-100 text-yellow-800'
			: 'bg-gray-100 text-gray-800'}"
	>
		{isDirty ? 'Modified' : 'Clean'}
	</span>
</div>
