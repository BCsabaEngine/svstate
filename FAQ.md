# Frequently Asked Questions (FAQ)

Common questions and answers about svstate.

## Table of Contents

- [General Questions](#general-questions)
- [Validation](#validation)
- [Effects & Side Effects](#effects--side-effects)
- [Snapshots & Undo](#snapshots--undo)
- [Actions](#actions)
- [TypeScript & Types](#typescript--types)
- [Plugins](#plugins)
- [Troubleshooting](#troubleshooting)

---

## General Questions

### What is svstate and what problem does it solve?

svstate is a Svelte 5 library that provides a supercharged `$state()` with deep reactive proxies. It solves the problem of managing complex, nested state objects by providing:

- Automatic change detection at any nesting level
- Structured validation that mirrors your data shape
- Property change events with full context (what changed, old/new values)
- Snapshot-based undo/redo system
- Dirty state tracking

**Use it when:** You have complex forms, ERP/CRM applications, or any state beyond simple username/password fields.

---

### When should I use svstate instead of plain Svelte 5 `$state()`?

**Use plain `$state()`** for:

- Simple, flat objects (login forms, toggles)
- State that doesn't need validation
- Temporary UI state

**Use svstate** for:

- Deeply nested objects (customer records, product catalogs)
- Forms requiring real-time validation
- Applications needing undo/redo functionality
- State that triggers side effects on changes
- Tracking dirty state for "unsaved changes" warnings

```typescript
// Plain $state is fine for this
const loginForm = $state({ username: '', password: '' });

// svstate shines for this
const customer = $state({
  name: 'Acme Corp',
  addresses: [{ type: 'billing', street: '123 Main St', city: 'NYC' }],
  billing: { bankAccount: { iban: '', swift: '' } }
});
```

---

### Does svstate work with Svelte 4 or only Svelte 5?

svstate requires **Svelte 5** because it uses the `$state()` rune internally. It is not compatible with Svelte 4's store-based reactivity.

**Requirements:**

- Svelte 5
- Node.js >= 20
- npm >= 9

---

### Can I use svstate with SvelteKit?

**Yes!** svstate works seamlessly with SvelteKit. Use it in your `+page.svelte` or component files just like any other Svelte 5 state:

```svelte
<script lang="ts">
import { createSvState, stringValidator } from 'svstate';

const { data, state: { errors, hasErrors } } = createSvState(
  { email: '', name: '' },
  {
    validator: (source) => ({
      email: stringValidator(source.email, 'trim').required().email().getError(),
      name: stringValidator(source.name, 'trim').required().getError()
    })
  }
);
</script>

<input bind:value={data.email} />
{#if $errors?.email}<span class="error">{$errors.email}</span>{/if}
```

---

### How does per-field dirty tracking work?

svstate tracks which specific fields have been modified via the `isDirtyByField` store. It returns a `DirtyFields` object where keys are dot-notation property paths and values are `true`:

```typescript
const {
  data,
  state: { isDirty, isDirtyByField }
} = createSvState({
  name: '',
  address: { street: '', city: '' }
});

data.address.street = '123 Main St';

// $isDirtyByField → { "address.street": true, "address": true }
// $isDirty → true (derived from isDirtyByField)
```

**Key behaviors:**

- When a nested field changes, all parent paths are also marked dirty (e.g., changing `address.street` also marks `address` as dirty)
- `isDirty` is derived from `isDirtyByField` — it's `true` when any field is dirty
- Cleared on `reset()`, `rollback()`, and successful action (respecting `resetDirtyOnAction`)
- Useful for highlighting changed fields in the UI or showing "unsaved changes" per section

```svelte
<!-- Highlight changed fields -->
<input
  bind:value={data.name}
  class:modified={$isDirtyByField['name']}
/>

<!-- Show section-level dirty indicator -->
{#if $isDirtyByField['address']}
  <span class="badge">Modified</span>
{/if}
```

---

## Validation

### How does validation work and when does it run?

Validation runs automatically whenever any property changes. By default, it's debounced using `queueMicrotask()` to batch multiple rapid changes into a single validation pass.

```typescript
const {
  data,
  state: { errors }
} = createSvState(
  { email: '' },
  {
    validator: (source) => ({
      email: stringValidator(source.email).required().email().getError()
    })
  }
);

// Changing data.email triggers validation automatically
data.email = 'invalid'; // $errors.email = "Invalid email format"
data.email = 'valid@example.com'; // $errors.email = ""
```

**Customize debouncing:**

```typescript
createSvState(data, actuators, {
  debounceValidation: 300 // Wait 300ms after last change
});
```

---

### Can I use Zod, Yup, or other validation libraries instead of built-in validators?

**Yes!** The `validator` function just needs to return an object matching your error structure. Use any validation library:

```typescript
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  age: z.number().min(18)
});

const {
  data,
  state: { errors }
} = createSvState(
  { email: '', age: 0 },
  {
    validator: (source) => {
      const result = schema.safeParse(source);
      if (result.success) return { email: '', age: '' };

      const fieldErrors = result.error.flatten().fieldErrors;
      return {
        email: fieldErrors.email?.[0] ?? '',
        age: fieldErrors.age?.[0] ?? ''
      };
    }
  }
);
```

---

### Why does my error structure need to mirror my data structure?

This design provides **type safety** and **intuitive access** to errors. When your error object has the same shape as your data, you can access errors using the same paths:

```typescript
// Data structure
const data = {
  address: {
    street: '',
    city: ''
  }
};

// Error structure mirrors it
const errors = {
  address: {
    street: 'Required',
    city: ''
  }
};

// Access is intuitive
$errors?.address?.street; // "Required"
$errors?.address?.city; // ""
```

This also enables TypeScript to provide autocomplete for error paths.

---

### How do I validate arrays and their items?

Use `arrayValidator` for the array itself. For validating individual items, map over them in your validator:

```typescript
const {
  data,
  state: { errors }
} = createSvState(
  {
    tags: ['svelte', 'typescript'],
    contacts: [{ name: '', email: '' }]
  },
  {
    validator: (source) => ({
      // Validate the array itself
      tags: arrayValidator(source.tags).minLength(1).maxLength(10).unique().getError(),

      // Validate each contact item
      contacts: source.contacts.map((contact) => ({
        name: stringValidator(contact.name, 'trim').required().getError(),
        email: stringValidator(contact.email, 'trim').required().email().getError()
      }))
    })
  }
);
```

---

## Effects & Side Effects

### What is the effect callback and when should I use it?

The `effect` callback fires whenever any property changes, giving you full context about what changed. Use it for:

- Creating undo snapshots
- Logging/analytics
- Cross-field updates
- Triggering API calls on specific changes

```typescript
const { data } = createSvState(formData, {
  effect: ({ target, property, currentValue, oldValue, snapshot }) => {
    console.log(`${property}: ${oldValue} → ${currentValue}`);

    // Create snapshot for undo
    snapshot(`Changed ${property}`);

    // Trigger side effect for specific field
    if (property === 'country') {
      loadTaxRates(currentValue);
    }
  }
});
```

---

### Can I use async operations in the effect callback?

**No.** The effect callback must be synchronous. If you return a Promise, svstate throws an error.

For async operations, use the `action` instead:

```typescript
// ❌ Wrong - will throw error
effect: async ({ property }) => {
  await saveToServer(); // Error!
};

// ✅ Correct - use action for async
action: async () => {
  await saveToServer();
};
```

---

### What does the `property` path look like for nested objects and arrays?

The `property` is a dot-notation path string:

| Change                           | Property Path         |
| -------------------------------- | --------------------- |
| `data.name = 'John'`             | `"name"`              |
| `data.address.city = 'NYC'`      | `"address.city"`      |
| `data.billing.bank.iban = '...'` | `"billing.bank.iban"` |
| `data.contacts[0].email = '...'` | `"contacts.email"`    |
| `data.tags.push('new')`          | `"tags"`              |

**Note:** Array indices are collapsed — you get `"contacts.email"` not `"contacts.0.email"`.

---

## Snapshots & Undo

### How does the snapshot/undo system work?

Call `snapshot(title)` in your effect to create undo points. Each snapshot stores a deep clone of the current state:

```typescript
const {
  data,
  rollback,
  reset,
  state: { snapshots }
} = createSvState(formData, {
  effect: ({ snapshot, property }) => {
    snapshot(`Changed ${property}`);
  }
});

// Make changes
data.name = 'New Name'; // Creates snapshot "Changed name"
data.email = 'new@example.com'; // Creates snapshot "Changed email"

// Undo
rollback(); // Reverts to "Changed name" state
rollback(2); // Reverts 2 steps back

// Reset to initial
reset(); // Returns to original state
```

---

### What does the `replace` parameter in `snapshot(title, replace)` do?

When `replace` is `true` (default), consecutive snapshots with the same title replace each other instead of stacking. This prevents snapshot bloat during rapid typing:

```typescript
effect: ({ snapshot }) => {
  // User types "Hello" quickly
  // Without replace: 5 snapshots ("H", "He", "Hel", "Hell", "Hello")
  // With replace: 1 snapshot ("Hello")
  snapshot('Typing in name field'); // Same title = replaces previous
};

// Force new snapshot even with same title
snapshot('Important change', false);
```

---

### Does rollback trigger validation?

**Yes.** Both `rollback()` and `reset()` trigger validation after restoring state, ensuring your error state stays in sync with your data.

---

## Actions

### What is the action and how does it differ from the effect?

| Feature       | Effect                               | Action                          |
| ------------- | ------------------------------------ | ------------------------------- |
| **Trigger**   | Automatically on any property change | Manually via `execute()`        |
| **Async**     | Must be synchronous                  | Can be async                    |
| **Purpose**   | Side effects, snapshots              | Submit data to backend          |
| **Frequency** | Fires on every change                | Fires once per `execute()` call |

```typescript
const { data, execute } = createSvState(formData, {
  // Effect: runs on every change (sync only)
  effect: ({ snapshot, property }) => {
    snapshot(`Changed ${property}`);
  },

  // Action: runs when you call execute() (can be async)
  action: async () => {
    await fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
});

// Trigger action manually
await execute();
```

---

### How do I show a loading spinner during action execution?

Use the `actionInProgress` store:

```svelte
<script>
const { execute, state: { actionInProgress, hasErrors } } = createSvState(/* ... */);
</script>

<button onclick={() => execute()} disabled={$hasErrors || $actionInProgress}>
  {$actionInProgress ? 'Saving...' : 'Save'}
</button>
```

---

### Can I pass parameters to the action?

**Yes!** Define a parameter type and pass values to `execute()`:

```typescript
type SaveParams = { draft?: boolean; redirect?: string };

const { execute } = createSvState<FormData, FormErrors, SaveParams>(formData, {
  action: async (params) => {
    await saveToServer({ ...data, isDraft: params?.draft });
    if (params?.redirect) goto(params.redirect);
  }
});

// Different buttons, different behaviors
execute({ draft: true }); // Save as draft
execute({ draft: false, redirect: '/list' }); // Publish and redirect
execute(); // Default save
```

---

## TypeScript & Types

### What types does svstate export and when should I use them?

svstate exports these types for building type-safe external functions:

```typescript
import type {
  Validator,
  EffectContext,
  Snapshot,
  SnapshotFunction,
  SvStateOptions,
  AsyncValidator,
  AsyncValidatorFunction,
  AsyncErrors,
  DirtyFields
} from 'svstate';
```

| Type                        | Use Case                                                     |
| --------------------------- | ------------------------------------------------------------ |
| `Validator`                 | Type for validation error objects                            |
| `EffectContext<T>`          | Type effect callbacks when defined externally                |
| `SnapshotFunction`          | Type for the `snapshot` function parameter                   |
| `Snapshot<T>`               | Type for snapshot history entries                            |
| `SvStateOptions`            | Type for configuration options                               |
| `AsyncValidator<T>`         | Object mapping property paths to async validator functions   |
| `AsyncValidatorFunction<T>` | Async function: `(value, source, signal) => Promise<string>` |
| `AsyncErrors`               | Object mapping property paths to error strings               |
| `DirtyFields`               | Object mapping dot-notation paths to dirty status            |

**Example:**

```typescript
// External validator function
const validateUser = (source: UserData): UserErrors => ({
  name: stringValidator(source.name).required().getError(),
  email: stringValidator(source.email).required().email().getError()
});

// External effect function
const userEffect = ({ snapshot, property }: EffectContext<UserData>) => {
  snapshot(`Updated ${property}`);
};

const { data } = createSvState(userData, {
  validator: validateUser,
  effect: userEffect
});
```

---

## Plugins

### What is the plugin system and when should I use it?

Plugins extend `createSvState` with reusable behaviors via lifecycle hooks. Use them when you need cross-cutting concerns like persistence, auto-saving, debugging, or analytics — without cluttering your effect or action callbacks.

Plugins are passed via the `plugins` option array:

```typescript
import { createSvState, persistPlugin, devtoolsPlugin } from 'svstate';

const { data, destroy } = createSvState(formData, actuators, {
  plugins: [persistPlugin({ key: 'my-form' }), devtoolsPlugin({ name: 'MyForm' })]
});

// Call destroy() to clean up plugin resources (e.g., in onDestroy)
destroy();
```

---

### What built-in plugins are available?

svstate ships with 7 built-in plugins:

| Plugin            | Purpose                                      | Import                                      |
| ----------------- | -------------------------------------------- | ------------------------------------------- |
| `persistPlugin`   | Persist state to localStorage/custom storage | `import { persistPlugin } from 'svstate'`   |
| `autosavePlugin`  | Auto-save after idle/interval                | `import { autosavePlugin } from 'svstate'`  |
| `devtoolsPlugin`  | Console logging of all events                | `import { devtoolsPlugin } from 'svstate'`  |
| `historyPlugin`   | Sync state fields to URL params              | `import { historyPlugin } from 'svstate'`   |
| `syncPlugin`      | Cross-tab sync via BroadcastChannel          | `import { syncPlugin } from 'svstate'`      |
| `undoRedoPlugin`  | Redo stack on top of built-in rollback       | `import { undoRedoPlugin } from 'svstate'`  |
| `analyticsPlugin` | Batch event buffering for analytics          | `import { analyticsPlugin } from 'svstate'` |

---

### How do I persist state to localStorage?

Use `persistPlugin` to automatically save and restore state:

```typescript
import { persistPlugin } from 'svstate';

const persist = persistPlugin({
  key: 'my-form', // Required: storage key
  throttle: 300, // Write debounce ms (default: 300)
  exclude: ['password'], // Don't persist these fields
  include: ['name', 'email'] // Only persist these fields (mutually exclusive with exclude)
});

const { data, reset } = createSvState(formData, actuators, {
  plugins: [persist]
});

// Check if state was restored from storage
persist.isRestored(); // true/false

// Clear persisted data
persist.clearPersistedState();
```

Reload the page and your state will be automatically restored.

---

### How do I add undo/redo support?

The built-in `rollback()` provides undo. Add `undoRedoPlugin` for redo:

```typescript
import { undoRedoPlugin } from 'svstate';

const undoRedo = undoRedoPlugin();

const { data, rollback } = createSvState(
  formData,
  {
    effect: ({ snapshot, property }) => {
      snapshot(`Changed ${property}`);
    }
  },
  { plugins: [undoRedo] }
);

// Undo (built-in)
rollback();

// Redo (from plugin)
undoRedo.redo();

// Check if redo is available
undoRedo.canRedo(); // boolean

// Reactive redo stack
undoRedo.redoStack; // Readable<Snapshot[]>
```

---

### How do I sync state across browser tabs?

Use `syncPlugin` which uses BroadcastChannel to sync state changes:

```typescript
import { syncPlugin } from 'svstate';

const sync = syncPlugin({
  key: 'my-form-sync', // Required: channel name
  throttle: 100 // Broadcast debounce ms (default: 100)
});

const { data } = createSvState(formData, actuators, {
  plugins: [sync]
});

// Changes in one tab automatically appear in all other tabs with the same key
```

---

### How do I write a custom plugin?

Implement the `SvStatePlugin<T>` interface — all hooks are optional:

```typescript
import type { SvStatePlugin, ChangeEvent } from 'svstate';

const myPlugin: SvStatePlugin<MyState> = {
  name: 'my-plugin',
  onInit(context) {
    // Access: context.data, context.state, context.options, context.snapshot
  },
  onChange(event) {
    console.log(`${event.property}: ${event.oldValue} → ${event.currentValue}`);
  },
  onValidation(errors) {
    /* Called after sync validation */
  },
  onSnapshot(snapshot) {
    /* Called when snapshot is created */
  },
  onAction(event) {
    if (event.phase === 'before') {
      /* Action starting */
    }
    if (event.phase === 'after') {
      /* Action done, check event.error */
    }
  },
  onRollback(snapshot) {
    /* Called after rollback */
  },
  onReset() {
    /* Called after reset */
  },
  destroy() {
    /* Cleanup resources */
  }
};
```

**Hook execution order:** Hooks run in plugin array order (first to last), except `destroy` which runs last-to-first.

---

### Can I combine multiple plugins?

**Yes!** Plugins are composed via the `plugins` array. They run independently and don't interfere with each other:

```typescript
const { data } = createSvState(formData, actuators, {
  plugins: [
    persistPlugin({ key: 'my-form' }),
    syncPlugin({ key: 'my-form-sync' }),
    autosavePlugin({ save: (d) => api.saveDraft(d), idle: 2000 }),
    devtoolsPlugin({ name: 'MyForm' }),
    analyticsPlugin({ onFlush: (events) => sendToAnalytics(events) })
  ]
});
```

---

## Troubleshooting

### Why aren't my changes triggering validation or effects?

**Common causes:**

1. **Setting same value:** svstate uses strict equality (`!==`) to skip unchanged values:

   ```typescript
   data.name = 'John';
   data.name = 'John'; // No effect triggered (same value)
   ```

2. **Mutating non-proxied types:** Date, Map, Set, RegExp, Error, and Promise are not proxied:

   ```typescript
   data.date.setFullYear(2025); // Won't trigger effect
   data.date = new Date(2025, 0, 1); // Will trigger effect
   ```

3. **Replacing the entire object:** Assign to properties, not the whole object:

   ```typescript
   data = { name: 'New' }; // Won't work
   Object.assign(data, { name: 'New' }); // Works
   data.name = 'New'; // Works
   ```

---

### Why is `hasErrors` true when all my error strings are empty?

The `hasErrors` store recursively checks if any leaf string in your error object is non-empty. Check that:

1. All error paths return empty strings (`''`) when valid, not `undefined` or `null`
2. Your validator returns the complete error structure even when valid

```typescript
// ❌ Wrong - undefined values
validator: (source) => ({
  name: source.name ? undefined : 'Required' // Don't use undefined
});

// ✅ Correct - empty strings
validator: (source) => ({
  name: stringValidator(source.name).required().getError() // Returns '' when valid
});
```

---

### How do I debug what's happening inside svstate?

Add logging to your effect to see all changes:

```typescript
effect: ({ target, property, currentValue, oldValue, snapshot }) => {
  console.log('[svstate]', {
    property,
    from: oldValue,
    to: currentValue,
    fullState: JSON.parse(JSON.stringify(target))
  });
  snapshot(`Changed ${property}`);
};
```

For validation debugging, log the full error object:

```typescript
$effect(() => {
  console.log('Errors:', $errors);
  console.log('Has errors:', $hasErrors);
});
```

---

### My action keeps getting blocked. What's happening?

By default, svstate prevents concurrent action execution. If `actionInProgress` is true, subsequent `execute()` calls are ignored.

**Solutions:**

1. **Wait for completion:** Ensure previous action finished before calling again

2. **Allow concurrent actions:**

   ```typescript
   createSvState(data, actuators, {
     allowConcurrentActions: true
   });
   ```

3. **Check status before calling:**

   ```svelte
   <button disabled={$actionInProgress} onclick={() => execute()}>
     Save
   </button>
   ```

---

## Still Have Questions?

- **Documentation**: See [README.md](README.md) for comprehensive guides
- **Issues**: [GitHub Issues](https://github.com/BCsabaEngine/svstate/issues)
- **Live Demo**: [Try it in your browser](https://bcsabaengine.github.io/svstate/)
