<script lang="ts">
	import ErrorText from './ErrorText.svelte';

	interface Properties {
		label: string;
		id: string;
		type?: 'text' | 'email' | 'number';
		placeholder?: string;
		value: string | number;
		error?: string;
		required?: boolean;
		min?: number;
		max?: number;
		step?: number;
		variant?: 'default' | 'nested';
	}

	let {
		label,
		id,
		type = 'text',
		placeholder = '',
		value = $bindable(),
		error = '',
		required = true,
		min,
		max,
		step,
		variant = 'default'
	}: Properties = $props();

	const bgClass = $derived(variant === 'nested' ? 'bg-white' : 'bg-gray-50');
</script>

<div>
	<label class="mb-2 block text-sm text-gray-900 {required ? 'font-bold' : ''}" for={id}>
		{label}
	</label>
	<input
		{id}
		class="block w-full rounded-lg border p-2.5 text-sm {error
			? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
			: `border-gray-300 ${bgClass} text-gray-900 focus:border-blue-500 focus:ring-blue-500`}"
		{max}
		{min}
		{placeholder}
		{step}
		{type}
		bind:value
	/>
	<ErrorText error={error ?? ''} />
</div>
