<script lang="ts">
	interface Properties {
		error: string;
		id?: string;
	}

	let { error, id }: Properties = $props();
</script>

{#if error}
	<p {id} class="mt-1 text-sm text-red-600" role="alert">{error}</p>
{/if}
