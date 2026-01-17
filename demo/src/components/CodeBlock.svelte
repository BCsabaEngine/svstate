<script lang="ts">
	interface Properties {
		title?: string;
		code: string;
	}

	let { title, code }: Properties = $props();
</script>

<div>
	{#if title}
		<h6 class="mb-2 text-sm font-medium text-gray-700">{title}</h6>
	{/if}
	<pre class="overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">{code}</pre>
</div>
