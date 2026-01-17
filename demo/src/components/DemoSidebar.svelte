<script lang="ts">
	interface Properties {
		data: unknown;
		errors: unknown;
		isDirty: boolean;
		hasErrors: boolean;
		onFill: () => void;
		width?: 'w-80' | 'w-96';
	}

	let { data, errors, isDirty, hasErrors, onFill, width = 'w-80' }: Properties = $props();
</script>

<div class="{width} flex-shrink-0 space-y-4">
	<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
		<h6 class="mb-2 text-sm font-medium text-gray-700">State Object</h6>
		<pre class="overflow-auto text-xs text-gray-600">{JSON.stringify(data, undefined, 2)}</pre>
	</div>

	<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
		<h6 class="mb-2 text-sm font-medium text-gray-700">State Info</h6>
		<div class="space-y-1 text-xs text-gray-600">
			<div><span class="font-medium">isDirty:</span> {isDirty}</div>
			<div><span class="font-medium">hasErrors:</span> {hasErrors}</div>
		</div>
	</div>

	<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
		<h6 class="mb-2 text-sm font-medium text-gray-700">Errors</h6>
		<pre class="overflow-auto text-xs text-gray-600">{JSON.stringify(errors, undefined, 2)}</pre>
	</div>

	<button
		class="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
		onclick={onFill}
		type="button"
	>
		Fill with Valid Data
	</button>
</div>
