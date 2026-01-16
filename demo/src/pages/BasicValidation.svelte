<script lang="ts">
	import { createSvState, numberValidator, stringValidator } from '../../../src/index';
	import ErrorText from '../components/ErrorText.svelte';

	let showSourceCode = $state(false);

	const stateSourceCode = `const sourceData = {
  username: '',
  email: '',
  age: 0,
  bio: '',
  website: ''
};

const {
  data,
  state: { errors, hasErrors, isDirty }
} = createSvState(sourceData, {
  validator: (source) => ({
    username: stringValidator(source.username, 'trim')
      .required()
      .minLength(3)
      .maxLength(20)
      .noSpace()
      .getError(),
    email: stringValidator(source.email, 'trim')
      .required()
      .email()
      .getError(),
    age: numberValidator(source.age)
      .required()
      .min(18)
      .max(120)
      .integer()
      .getError(),
    bio: stringValidator(source.bio)
      .maxLength(200)
      .getError(),
    website: stringValidator(source.website, 'trim')
      .website('required')
      .getError()
  })
});`;

	const formSourceCode = `<input
  id="username"
  type="text"
  placeholder="Enter username"
  class="... {$errors?.username ? 'error-styles' : 'normal-styles'}"
  bind:value={data.username}
/>
<ErrorText error={$errors?.username ?? ''} />`;

	const sourceData = {
		username: '',
		email: '',
		age: 0,
		bio: '',
		website: ''
	};

	const randomId = () => Math.random().toString(36).slice(2, 8);
	const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

	const {
		data,
		state: { errors, hasErrors, isDirty }
	} = createSvState(sourceData, {
		validator: (source) => ({
			username: stringValidator(source.username, 'trim')
				.required()
				.minLength(3)
				.maxLength(20)
				.noSpace()
				.getError(),
			email: stringValidator(source.email, 'trim').required().email().getError(),
			age: numberValidator(source.age).required().min(18).max(120).integer().getError(),
			bio: stringValidator(source.bio).maxLength(200).getError(),
			website: stringValidator(source.website, 'trim').website('required').getError()
		})
	});

	const fillWithValidData = () => {
		data.username = `user${randomId()}`;
		data.email = `${randomId()}@example.com`;
		data.age = randomInt(18, 65);
		data.bio = 'Hello, I am a demo user!';
		data.website = `https://${randomId()}.com`;
	};
</script>

<div class="flex gap-6">
	<div class="max-w-xl flex-1 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<h5 class="mb-4 text-xl font-medium text-gray-900">Basic Validation Demo</h5>

		<div class="mb-4 flex gap-2">
			<span
				class="rounded px-2.5 py-0.5 text-xs font-medium {$hasErrors
					? 'bg-red-100 text-red-800'
					: 'bg-green-100 text-green-800'}"
			>
				{$hasErrors ? 'Has Errors' : 'Valid'}
			</span>
			<span
				class="rounded px-2.5 py-0.5 text-xs font-medium {$isDirty
					? 'bg-yellow-100 text-yellow-800'
					: 'bg-gray-100 text-gray-800'}"
			>
				{$isDirty ? 'Modified' : 'Clean'}
			</span>
		</div>

		<div class="space-y-4">
			<div>
				<label class="mb-2 block text-sm font-bold text-gray-900" for="username">Username</label>
				<input
					id="username"
					class="block w-full rounded-lg border p-2.5 text-sm {$errors?.username
						? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
						: 'border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-500 focus:ring-blue-500'}"
					placeholder="Enter username"
					type="text"
					bind:value={data.username}
				/>
				<ErrorText error={$errors?.username ?? ''} />
			</div>

			<div>
				<label class="mb-2 block text-sm font-bold text-gray-900" for="email">Email</label>
				<input
					id="email"
					class="block w-full rounded-lg border p-2.5 text-sm {$errors?.email
						? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
						: 'border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-500 focus:ring-blue-500'}"
					placeholder="Enter email"
					type="email"
					bind:value={data.email}
				/>
				<ErrorText error={$errors?.email ?? ''} />
			</div>

			<div>
				<label class="mb-2 block text-sm font-bold text-gray-900" for="age">Age</label>
				<input
					id="age"
					class="block w-full rounded-lg border p-2.5 text-sm {$errors?.age
						? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
						: 'border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-500 focus:ring-blue-500'}"
					placeholder="Enter age"
					type="number"
					bind:value={data.age}
				/>
				<ErrorText error={$errors?.age ?? ''} />
			</div>

			<div>
				<label class="mb-2 block text-sm text-gray-900" for="bio">Bio</label>
				<textarea
					id="bio"
					class="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
					placeholder="Tell us about yourself"
					rows="3"
					bind:value={data.bio}
				></textarea>
				<ErrorText error={$errors?.bio ?? ''} />
			</div>

			<div>
				<label class="mb-2 block text-sm text-gray-900" for="website">Website</label>
				<input
					id="website"
					class="block w-full rounded-lg border p-2.5 text-sm {$errors?.website
						? 'border-red-500 bg-red-50 text-red-900 placeholder-red-400 focus:border-red-500 focus:ring-red-500'
						: 'border-gray-300 bg-gray-50 text-gray-900 focus:border-blue-500 focus:ring-blue-500'}"
					placeholder="https://example.com"
					type="text"
					bind:value={data.website}
				/>
				<ErrorText error={$errors?.website ?? ''} />
			</div>
		</div>
	</div>

	<div class="w-80 flex-shrink-0 space-y-4">
		<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
			<h6 class="mb-2 text-sm font-medium text-gray-700">State Object</h6>
			<pre class="overflow-auto text-sm text-gray-600">{JSON.stringify(data, undefined, 2)}</pre>
		</div>

		<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
			<h6 class="mb-2 text-sm font-medium text-gray-700">State Info</h6>
			<div class="space-y-1 text-xs text-gray-600">
				<div><span class="font-medium">isDirty:</span> {$isDirty}</div>
				<div><span class="font-medium">hasErrors:</span> {$hasErrors}</div>
			</div>
		</div>

		<div class="rounded-lg border border-gray-300 bg-gray-50 p-4 shadow-inner">
			<h6 class="mb-2 text-sm font-medium text-gray-700">Errors</h6>
			<pre class="overflow-auto text-xs text-gray-600">{JSON.stringify($errors, undefined, 2)}</pre>
		</div>
		<button
			class="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
			onclick={fillWithValidData}
			type="button"
		>
			Fill with Valid Data
		</button>
	</div>
</div>

<div class="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm">
	<button
		class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-50 {showSourceCode
			? 'border-b border-gray-200'
			: ''}"
		onclick={() => (showSourceCode = !showSourceCode)}
		type="button"
	>
		<span>Source Code</span>
		<svg
			class="h-5 w-5 transform transition-transform {showSourceCode ? 'rotate-180' : ''}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
		</svg>
	</button>

	{#if showSourceCode}
		<div class="space-y-4 p-4">
			<div>
				<h6 class="mb-2 text-sm font-medium text-gray-700">State Setup</h6>
				<pre
					class="overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">{stateSourceCode}</pre>
			</div>
			<div>
				<h6 class="mb-2 text-sm font-medium text-gray-700">Form Binding Example</h6>
				<pre
					class="overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">{formSourceCode}</pre>
			</div>
		</div>
	{/if}
</div>
