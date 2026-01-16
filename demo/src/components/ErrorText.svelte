<script lang="ts">
	interface Props {
		error: string;
	}

	let { error }: Props = $props();
</script>

{#if error}
	<p class="mt-1 text-sm text-red-600">{error}</p>
{/if}
