<script lang="ts">
	import ErrorText from './ErrorText.svelte';

	interface Properties {
		label: string;
		id: string;
		placeholder?: string;
		value: string;
		error?: string;
		required?: boolean;
		isDirty?: boolean;
		rows?: number;
	}

	let {
		label,
		id,
		placeholder = '',
		value = $bindable(),
		error = '',
		required = false,
		isDirty,
		rows = 3
	}: Properties = $props();
</script>

<div>
	<label class="mb-2 block text-sm text-gray-900 {required ? 'font-bold' : ''}" for={id}>
		{label}
		{#if isDirty}
			<span class="ml-1 inline-block h-2 w-2 rounded-full bg-amber-400" title="Modified"></span>
		{/if}
	</label>
	<textarea
		{id}
		class="block w-full rounded-lg border p-2.5 text-sm {error
			? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
			: 'border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-500 focus:ring-blue-500'}"
		{placeholder}
		{rows}
		bind:value
	></textarea>
	<ErrorText error={error ?? ''} />
</div>
