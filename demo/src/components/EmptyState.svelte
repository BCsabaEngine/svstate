<script lang="ts">
	interface Properties {
		message: string;
	}

	let { message }: Properties = $props();
</script>

<div class="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
	<p class="text-sm text-gray-500">{message}</p>
</div>
