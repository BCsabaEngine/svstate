<script lang="ts">
	import { SvState } from '../../src/state.svelte';
	import { StringValidator } from '../../src/validators';

	const sourceData = { name: 'Csaba', age: 10, address: { city: '', zip: '' } };

	const {
		data,
		execute,
		state: { inProgress, allValid, isValid }
	} = new SvState(sourceData, {
		validator: (source) => ({
			name: new StringValidator(source.name, 'trim').maxLength(5).getError()
		}),
		changed: (target, property) => {
			if (property === 'name') target.age = target.name.length * 2;
			if (property === 'age') target.address.zip = (1000 + target.age).toString();
		},
		action: async (a) => {
			/* eslint-disable no-console */
			return new Promise((resolve) =>
				setTimeout(() => {
					console.log('Submit form...', JSON.stringify(data) + JSON.stringify(a));
					resolve();
				}, Math.random() * 1000)
			);
		},
		submitted: (error) => {
			/* eslint-disable no-console */
			console.log('Form submission:', error ? 'failed' : 'succeeded', error);
		}
	});
</script>

<form>
	<label
		>Name: <input bind:value={data.name} />
		{#if $isValid?.name}<span class="error">{$isValid?.name}</span>{/if}
	</label>

	<label
		>Age: <input type="number" bind:value={data.age} />
		{#if $isValid?.name}<span class="error">{$isValid?.name}</span>{/if}
	</label>

	<label
		>ZIP: <input type="text" bind:value={data.address.zip} />
		{#if $isValid?.name}<span class="error">{$isValid?.name}</span>{/if}
	</label>
</form>

{#if !$allValid}
	<p class="error">Form is not valid!</p>
{/if}

<button disabled={$inProgress} on:click|preventDefault={() => execute({ a: 12 })}>
	{#if $inProgress}Submitting...{:else}Submit{/if}
</button>

<style>
	.error {
		color: red;
	}
</style>
