<script lang="ts">
	import { FormLogic } from '../../src/form.svelte';
	import { StringValidator } from '../../src/validators';

	const sourceData = { name: 'Csaba', age: 10, address: { city: '', zip: '' } };

	const {
		formData,
		formExecute,
		formState: { stateInProgress, stateAllValid, stateIsValid }
	} = new FormLogic(
		sourceData,
		async (a) => {
			/* eslint-disable no-console */
			console.log('Form submitted', JSON.stringify(formData) + JSON.stringify(a));
			return new Promise((resolve) => setTimeout(resolve, 1000));
		},
		{
			validator: (source) => ({
				name: new StringValidator(source.name, 'trim').maxLength(5).getError()
			}),
			changed: (target, property) => {
				if (property === 'name') target.age = target.name.length * 2;
				if (property === 'age') target.address.zip = (1000 + target.age).toString();
			}
		}
	);
</script>

<form>
	<label
		>Name: <input bind:value={formData.name} />
		{#if $stateIsValid?.name}<span class="error">{$stateIsValid?.name}</span>{/if}
	</label>

	<label
		>Age: <input type="number" bind:value={formData.age} />
		{#if $stateIsValid?.name}<span class="error">{$stateIsValid?.name}</span>{/if}
	</label>

	<label
		>ZIP: <input type="text" bind:value={formData.address.zip} />
		{#if $stateIsValid?.name}<span class="error">{$stateIsValid?.name}</span>{/if}
	</label>
</form>

{#if !$stateAllValid}
	<p class="error">Form is not valid!</p>
{/if}

<button disabled={$stateInProgress} on:click|preventDefault={() => formExecute({ a: 12 })}>
	{#if $stateInProgress}Submitting...{:else}Submit{/if}
</button>

<style>
	.error {
		color: red;
	}
</style>
