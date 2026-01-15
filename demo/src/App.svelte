<script lang="ts">
	import './app.postcss';

	import Form from './Form.svelte';
</script>

Hello!

<Form />

<style>
	:global(body) {
		background-color: #f3f4f6;
	}

	:global(button) {
		cursor: pointer;
	}
</style>
