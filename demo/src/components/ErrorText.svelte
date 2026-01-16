<script lang="ts">
	interface Properties {
		error: string;
	}

	let { error }: Properties = $props();
</script>

{#if error}
	<p class="mt-1 text-sm text-red-600">{error}</p>
{/if}
