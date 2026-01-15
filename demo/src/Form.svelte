<script lang="ts">
	import { createSvState } from '../../src/state.svelte';
	import { stringValidator } from '../../src/validators';

	const sourceData = { name: 'Csaba', age: 10, address: { city: '', zip: '' } };

	const {
		data,
		execute,
		state: { actionInProgress, hasErrors, errors }
	} = createSvState(sourceData, {
		validator: (source) => ({
			name: stringValidator(source.name, 'trim').maxLength(5).getError()
		}),
		effect: (target, property) => {
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
		actionCompleted: (error) => {
			/* eslint-disable no-console */
			console.log('Form submission:', error ? 'failed' : 'succeeded', error);
		}
	});
</script>

<form>
	<label
		>Name: <input bind:value={data.name} />
		{#if $errors?.name}<span class="error">{$errors?.name}</span>{/if}
	</label>

	<label
		>Age: <input type="number" bind:value={data.age} />
		{#if $errors?.name}<span class="error">{$errors?.name}</span>{/if}
	</label>

	<label
		>ZIP: <input type="text" bind:value={data.address.zip} />
		{#if $errors?.name}<span class="error">{$errors?.name}</span>{/if}
	</label>
</form>

{#if $hasErrors}
	<p class="error">Form is not valid!</p>
{/if}

<button disabled={$actionInProgress} on:click|preventDefault={() => execute({ a: 12 })}>
	{#if $actionInProgress}Submitting...{:else}Submit{/if}
</button>

<style>
	.error {
		color: red;
	}
</style>
