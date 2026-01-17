<script lang="ts">
	interface Properties {
		title: string;
		subtitle?: string;
	}

	let { title, subtitle }: Properties = $props();
</script>

<h6 class="mb-3 border-b border-gray-200 pb-2 text-sm font-semibold text-gray-700">
	{title}
	{#if subtitle}
		<span class="font-normal text-gray-500">({subtitle})</span>
	{/if}
</h6>
