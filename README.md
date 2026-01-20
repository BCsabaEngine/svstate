# 🚀 svstate

### Supercharged `$state()` for Svelte 5

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)
[![Svelte 5](https://img.shields.io/badge/Svelte-5-orange.svg)](https://svelte.dev/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Tests](https://img.shields.io/badge/tests-300%2B-brightgreen.svg)]()
[![Coverage](https://img.shields.io/badge/coverage-%3E98%25-brightgreen.svg)]()

> **Deep reactive proxy with validation, snapshot/undo, and side effects — built for complex, real-world applications.**

<p align="center">
  <img src="svstate.png" alt="svstate" />
</p>

<p align="center">
  <a href="https://bcsabaengine.github.io/svstate/"><strong>🎮 Live Demo</strong></a> ·
  <a href="#-installation">Installation</a> ·
  <a href="#-core-features">Features</a> ·
  <a href="#-complete-examples">Examples</a>
</p>

---

## 🤔 The Problem

Svelte 5's `$state()` is fantastic for simple use cases. A login form? Easy. A settings toggle? Trivial.

But what about **real enterprise applications**?

```typescript
// ❌ A simple user/password form is NOT your problem
const loginForm = $state({ username: '', password: '' });

// ✅ THIS is your problem — a complex ERP customer page
const customer = $state({
  name: 'Acme Corp',
  taxId: 'US-12345678',
  creditLimit: 50000,
  addresses: [
    { type: 'billing', street: '123 Main St', city: 'New York', zip: '10001' },
    { type: 'shipping', street: '456 Oak Ave', city: 'Boston', zip: '02101' }
  ],
  contacts: [
    { name: 'John Doe', email: 'john@acme.com', phone: '555-1234', isPrimary: true },
    { name: 'Jane Smith', email: 'jane@acme.com', phone: '555-5678', isPrimary: false }
  ],
  billing: {
    paymentTerms: 'NET30',
    currency: 'USD',
    bankAccount: { iban: 'US12345678901234567890', swift: 'BOFA1234' }
  }
});
```

**With native Svelte 5, you're missing:**

- ❌ No automatic change detection for nested properties
- ❌ No built-in validation that mirrors your data structure
- ❌ No way to know _which_ property changed and react to it
- ❌ No undo/redo for complex editing workflows
- ❌ No dirty tracking across the entire object tree

---

## ✨ The Solution: svstate

**svstate** wraps your state in a deep reactive proxy that:

- 🔍 **Detects changes** at any nesting level (`customer.billing.bankAccount.iban`)
- ✅ **Validates** with a structure that mirrors your data
- ⚡ **Fires effects** when any property changes (with full context)
- ⏪ **Snapshots & undo** for complex editing workflows
- 🎯 **Tracks dirty state** automatically

```typescript
import { createSvState, stringValidator, numberValidator } from 'svstate';

const { data, state, rollback, reset, execute } = createSvState(customer, {
  validator: (source) => ({
    /* validation that mirrors your structure */
  }),
  effect: ({ snapshot, property, currentValue, oldValue }) => {
    console.log(`${property} changed from ${oldValue} to ${currentValue}`);
    snapshot(`Changed ${property}`); // Create undo point
  },
  action: async () => {
    /* Save to API */
  }
});

// Deep binding just works!
data.billing.bankAccount.iban = 'NEW-IBAN'; // ✅ Detected, validated, snapshot created
```

---

## 📦 Installation

```bash
npm install svstate
```

**Requirements:** Node.js ≥20, Svelte 5

**Note:** This package is distributed as ESM (ES Modules) only.

---

## 🎯 Core Features

### 1️⃣ Validation — Structure-Aware, Real-Time

Validation in svstate mirrors your data structure exactly. When you have nested objects, your validation errors have the same shape. No more flattening, no more path strings.

**Built-in fluent validators** handle common patterns with chainable methods:

```typescript
import { createSvState, stringValidator, numberValidator, dateValidator } from 'svstate';

const {
  data,
  state: { errors, hasErrors }
} = createSvState(
  {
    email: '',
    age: 0,
    birthDate: new Date(),
    tags: []
  },
  {
    validator: (source) => ({
      // Fluent API: chain validations, get first error
      email: stringValidator(source.email, 'trim') // 'trim' preprocesses input
        .required()
        .email()
        .maxLength(100)
        .getError(),

      age: numberValidator(source.age).required().integer().between(18, 120).getError(),

      birthDate: dateValidator(source.birthDate).required().past().minAge(18).getError(),

      tags: arrayValidator(source.tags).minLength(1).maxLength(10).unique().getError()
    })
  }
);

// In your template:
// $errors?.email → "Required" | "Invalid email format" | ""
// $hasErrors → true/false
```

**Key features:**

- 🔄 Automatic re-validation on any change (debounced via microtask)
- 📐 Error structure matches data structure exactly
- 🧹 String preprocessing: `'trim'`, `'normalize'`, `'upper'`, `'lower'`
- ⚡ First-error-wins: `getError()` returns the first failure

---

### 2️⃣ Effect — React to Every Change

JavaScript objects don't have property change events. **svstate fixes this.** The `effect` callback fires whenever _any_ property changes, giving you full context:

```typescript
const { data } = createSvState(formData, {
  effect: ({ target, property, currentValue, oldValue, snapshot }) => {
    // 'property' is the dot-notation path: "address.city", "contacts.0.email"
    console.log(`${property}: ${oldValue} → ${currentValue}`);

    // Create undo point on significant changes
    if (property.startsWith('billing')) {
      snapshot(`Modified billing: ${property}`);
    }

    // Trigger side effects
    if (property === 'country') {
      loadTaxRates(currentValue);
    }
  }
});
```

**Use cases:**

- 📸 Create snapshots for undo/redo
- 📊 Analytics tracking
- 🔗 Cross-field updates (computed fields)
- 🌐 Trigger API calls on specific changes

---

### 3️⃣ Action — Submit to Backend with Loading States

Each svstate instance has **one action** — typically for submitting data to your backend, REST API, or cloud database (Supabase, Firebase, etc.). The `actionInProgress` store lets you show loading spinners and disable UI while waiting for the server response. This is why async support is essential.

```typescript
const { data, execute, state: { actionInProgress, actionError } } = createSvState(
  formData,
  {
    validator: (source) => ({ /* ... */ }),
    action: async (params) => {
      // Submit to your backend, Supabase, Firebase, etc.
      const response = await fetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Save failed');
    },
    actionCompleted: (error) => {
      if (!error) showToast('Saved successfully!');
    }
  }
);

// Show loading state while waiting for server
<button onclick={() => execute()} disabled={$hasErrors || $actionInProgress}>
  {$actionInProgress ? 'Saving...' : 'Save'}
</button>
```

**Action parameters** — When you need different submit behaviors from multiple places (e.g., "Save Draft" vs "Publish", or "Save" vs "Save & Close"), pass parameters to `execute()`:

```typescript
const { data, execute } = createSvState(articleData, {
  action: async (params?: { draft?: boolean; redirect?: string }) => {
    await supabase.from('articles').upsert({
      ...data,
      status: params?.draft ? 'draft' : 'published',
      published_at: params?.draft ? null : new Date()
    });

    if (params?.redirect) goto(params.redirect);
  }
});

// Multiple submit buttons with different behaviors
<button onclick={() => execute({ draft: true })}>
  Save Draft
</button>

<button onclick={() => execute({ draft: false, redirect: '/articles' })}>
  Publish & Go Back
</button>

<button onclick={() => execute()}>
  Publish
</button>
```

**Key features:**

- 🎯 **One action per state** — focused on data submission
- ⏳ **`actionInProgress`** — show spinners, disable inputs while waiting
- 🔀 **Action parameters** — different behaviors from multiple submit points
- 🔒 Prevents concurrent execution by default
- ❌ `actionError` store captures failures
- 🔄 Successful action resets dirty state and snapshots

---

### 4️⃣ Undo — Snapshot-Based Time Travel

Complex forms need undo. svstate provides a snapshot system that captures state at meaningful moments:

```typescript
const {
  data,
  rollback,
  reset,
  state: { snapshots }
} = createSvState(formData, {
  effect: ({ snapshot, property }) => {
    // Create snapshot on each change
    // Same title = replaces previous (debouncing)
    snapshot(`Changed ${property}`);

    // Use snapshot(title, false) to always create new
  }
});

// Undo last change
rollback();

// Undo 3 changes
rollback(3);

// Reset to initial state
reset();

// Show history
$snapshots.forEach((s, i) => console.log(`${i}: ${s.title}`));
```

**Key features:**

- 📸 `snapshot(title, replace?)` — create undo points
- ⏪ `rollback(steps)` — undo N changes
- 🔄 `reset()` — return to initial state
- 📜 `snapshots` store — access full history
- 🔀 Smart deduplication: same title replaces previous snapshot

---

### 5️⃣ Options — Fine-Tune Behavior

Customize svstate behavior with options:

```typescript
const { data } = createSvState(formData, actuators, {
  // Reset isDirty after successful action (default: true)
  resetDirtyOnAction: true,

  // Debounce validation in ms (default: 0 = microtask)
  debounceValidation: 300,

  // Allow concurrent action executions (default: false)
  allowConcurrentActions: false,

  // Keep actionError until next action (default: false)
  persistActionError: false
});
```

| Option                   | Default | Description                              |
| ------------------------ | ------- | ---------------------------------------- |
| `resetDirtyOnAction`     | `true`  | Clear dirty flag after successful action |
| `debounceValidation`     | `0`     | Delay validation (0 = next microtask)    |
| `allowConcurrentActions` | `false` | Block execute() while action runs        |
| `persistActionError`     | `false` | Clear error on next change or action     |

---

## 🏗️ Complete Examples

### Example 1: ERP Customer Form with Nested Addresses

A complex customer management form with 3-level nesting, validation, undo, and API save:

```typescript
<script lang="ts">
import { createSvState, stringValidator, numberValidator, arrayValidator } from 'svstate';

// 📊 Complex nested data structure
const initialCustomer = {
  name: '',
  taxId: '',
  creditLimit: 0,
  address: {
    street: '',
    city: '',
    zip: '',
    country: ''
  },
  contacts: [
    { name: '', email: '', phone: '', isPrimary: true }
  ],
  billing: {
    paymentTerms: 'NET30',
    currency: 'USD',
    bankAccount: {
      iban: '',
      swift: ''
    }
  }
};

// 🚀 Create supercharged state
const {
  data,           // Deep reactive proxy
  execute,        // Trigger async action
  rollback,       // Undo changes
  reset,          // Reset to initial
  state: {
    errors,           // Validation errors (same structure as data)
    hasErrors,        // Quick boolean check
    isDirty,          // Has anything changed?
    actionInProgress, // Is action running?
    actionError,      // Last action error
    snapshots         // Undo history
  }
} = createSvState(initialCustomer, {

  // ✅ Validator mirrors data structure exactly
  validator: (source) => ({
    name: stringValidator(source.name, 'trim')
      .required()
      .minLength(2)
      .maxLength(100)
      .getError(),

    taxId: stringValidator(source.taxId, 'trim', 'upper')
      .required()
      .regexp(/^[A-Z]{2}-\d{8}$/, 'Format: XX-12345678')
      .getError(),

    creditLimit: numberValidator(source.creditLimit)
      .required()
      .min(0)
      .max(1_000_000)
      .getError(),

    // 📍 Nested address validation
    address: {
      street: stringValidator(source.address.street, 'trim')
        .required()
        .minLength(5)
        .getError(),
      city: stringValidator(source.address.city, 'trim')
        .required()
        .getError(),
      zip: stringValidator(source.address.zip, 'trim')
        .required()
        .minLength(5)
        .getError(),
      country: stringValidator(source.address.country)
        .required()
        .inArray(['US', 'CA', 'UK', 'DE', 'FR'])
        .getError()
    },

    // 📋 Array validation
    contacts: arrayValidator(source.contacts)
      .required()
      .minLength(1)
      .getError(),

    // 💳 3-level nested billing validation
    billing: {
      paymentTerms: stringValidator(source.billing.paymentTerms)
        .required()
        .inArray(['NET15', 'NET30', 'NET60', 'COD'])
        .getError(),
      currency: stringValidator(source.billing.currency)
        .required()
        .inArray(['USD', 'EUR', 'GBP'])
        .getError(),
      bankAccount: {
        iban: stringValidator(source.billing.bankAccount.iban, 'trim', 'upper')
          .required()
          .minLength(15)
          .maxLength(34)
          .getError(),
        swift: stringValidator(source.billing.bankAccount.swift, 'trim', 'upper')
          .required()
          .minLength(8)
          .maxLength(11)
          .getError()
      }
    }
  }),

  // ⚡ Effect fires on every change
  effect: ({ snapshot, property, currentValue, oldValue }) => {
    // Create undo point with descriptive title
    const fieldName = property.split('.').pop();
    snapshot(`Changed ${fieldName}`);

    // Log for debugging
    console.log(`[svstate] ${property}: "${oldValue}" → "${currentValue}"`);
  },

  // 🌐 Async save action
  action: async () => {
    const response = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to save customer');
    }
  },

  // ✅ Called after action (success or failure)
  actionCompleted: (error) => {
    if (error) {
      console.error('Save failed:', error);
    } else {
      console.log('Customer saved successfully!');
    }
  }
});
</script>

<!-- 📝 Template with deep bindings -->
<form onsubmit|preventDefault={() => execute()}>
  <!-- Basic fields -->
  <input bind:value={data.name} placeholder="Company Name" />
  {#if $errors?.name}<span class="error">{$errors.name}</span>{/if}

  <!-- 2-level nested: address.city -->
  <input bind:value={data.address.city} placeholder="City" />
  {#if $errors?.address?.city}<span class="error">{$errors.address.city}</span>{/if}

  <!-- 3-level nested: billing.bankAccount.iban -->
  <input bind:value={data.billing.bankAccount.iban} placeholder="IBAN" />
  {#if $errors?.billing?.bankAccount?.iban}
    <span class="error">{$errors.billing.bankAccount.iban}</span>
  {/if}

  <!-- Action buttons -->
  <div class="actions">
    <button type="submit" disabled={$hasErrors || $actionInProgress}>
      {$actionInProgress ? 'Saving...' : 'Save Customer'}
    </button>

    <button type="button" onclick={() => rollback()} disabled={$snapshots.length <= 1}>
      Undo ({$snapshots.length - 1})
    </button>

    <button type="button" onclick={reset} disabled={!$isDirty}>
      Reset
    </button>
  </div>

  {#if $actionError}
    <div class="error-banner">{$actionError.message}</div>
  {/if}
</form>
```

---

### Example 2: Product Inventory with Array Management

Managing arrays of items with validation at both array and item level:

```typescript
<script lang="ts">
import { createSvState, stringValidator, numberValidator, arrayValidator } from 'svstate';

// 📦 Product with inventory items
const initialProduct = {
  sku: '',
  name: '',
  description: '',
  price: 0,
  inventory: [
    { warehouseId: 'WH-001', quantity: 0, reorderPoint: 10 }
  ],
  tags: [] as string[]
};

const {
  data,
  rollback,
  state: { errors, hasErrors, isDirty, snapshots }
} = createSvState(initialProduct, {

  validator: (source) => ({
    sku: stringValidator(source.sku, 'trim', 'upper')
      .required()
      .regexp(/^[A-Z]{3}-\d{4}$/, 'Format: ABC-1234')
      .getError(),

    name: stringValidator(source.name, 'trim')
      .required()
      .minLength(3)
      .maxLength(100)
      .getError(),

    description: stringValidator(source.description, 'trim')
      .maxLength(500)
      .getError(),

    price: numberValidator(source.price)
      .required()
      .positive()
      .decimal(2)  // Max 2 decimal places
      .getError(),

    // 📋 Validate the array itself
    inventory: arrayValidator(source.inventory)
      .required()
      .minLength(1)
      .getError(),

    // 🏷️ Tags must be unique
    tags: arrayValidator(source.tags)
      .maxLength(10)
      .unique()
      .getError()
  }),

  effect: ({ snapshot, property, currentValue }) => {
    // Create snapshots for significant changes
    if (property === 'price') {
      snapshot(`Price: $${currentValue}`);
    } else if (property.startsWith('inventory')) {
      snapshot(`Updated inventory`);
    } else {
      snapshot(`Changed ${property}`);
    }
  }
});

// 🔧 Array manipulation functions
function addWarehouse() {
  data.inventory.push({
    warehouseId: `WH-${String(data.inventory.length + 1).padStart(3, '0')}`,
    quantity: 0,
    reorderPoint: 10
  });
}

function removeWarehouse(index: number) {
  data.inventory.splice(index, 1);
}

function addTag(tag: string) {
  if (tag && !data.tags.includes(tag)) {
    data.tags.push(tag);
  }
}

function removeTag(index: number) {
  data.tags.splice(index, 1);
}
</script>

<!-- Product form -->
<div class="product-form">
  <input bind:value={data.sku} placeholder="SKU (ABC-1234)" />
  {#if $errors?.sku}<span class="error">{$errors.sku}</span>{/if}

  <input bind:value={data.name} placeholder="Product Name" />
  <input type="number" bind:value={data.price} step="0.01" placeholder="Price" />

  <!-- 📦 Inventory locations (array) -->
  <section class="inventory">
    <h3>Inventory Locations</h3>
    {#if $errors?.inventory}
      <span class="error">{$errors.inventory}</span>
    {/if}

    {#each data.inventory as item, index}
      <div class="inventory-row">
        <input bind:value={item.warehouseId} placeholder="Warehouse ID" />
        <input type="number" bind:value={item.quantity} placeholder="Qty" />
        <input type="number" bind:value={item.reorderPoint} placeholder="Reorder at" />
        <button onclick={() => removeWarehouse(index)}>Remove</button>
      </div>
    {/each}

    <button onclick={addWarehouse}>+ Add Warehouse</button>
  </section>

  <!-- 🏷️ Tags (simple array) -->
  <section class="tags">
    <h3>Tags</h3>
    {#if $errors?.tags}<span class="error">{$errors.tags}</span>{/if}

    <div class="tag-list">
      {#each data.tags as tag, index}
        <span class="tag">
          {tag}
          <button onclick={() => removeTag(index)}>×</button>
        </span>
      {/each}
    </div>

    <input
      placeholder="Add tag..."
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          addTag(e.currentTarget.value);
          e.currentTarget.value = '';
        }
      }}
    />
  </section>

  <!-- Status bar -->
  <div class="status">
    <span class:dirty={$isDirty}>{$isDirty ? 'Modified' : 'Saved'}</span>
    <span>{$snapshots.length} snapshots</span>
    <button onclick={() => rollback()} disabled={$snapshots.length <= 1}>
      Undo
    </button>
  </div>
</div>
```

---

## 🧰 API Reference

### `createSvState(init, actuators?, options?)`

Creates a supercharged state object.

**Returns:**
| Property | Type | Description |
|----------|------|-------------|
| `data` | `T` | Deep reactive proxy — bind directly |
| `execute(params?)` | `(P?) => Promise<void>` | Run the configured action |
| `rollback(steps?)` | `(n?: number) => void` | Undo N changes (default: 1) |
| `reset()` | `() => void` | Return to initial state |
| `state.errors` | `Readable<V>` | Validation errors store |
| `state.hasErrors` | `Readable<boolean>` | Quick error check |
| `state.isDirty` | `Readable<boolean>` | Has state changed? |
| `state.actionInProgress` | `Readable<boolean>` | Is action running? |
| `state.actionError` | `Readable<Error>` | Last action error |
| `state.snapshots` | `Readable<Snapshot[]>` | Undo history |

### Built-in Validators

svstate ships with four fluent validator builders that cover the most common validation scenarios. Each validator uses a chainable API — call validation methods in sequence and finish with `getError()` to retrieve the first error message (or an empty string if valid).

String validators support optional preprocessing (`'trim'`, `'normalize'`, `'upper'`, `'lower'`) applied before validation. All validators return descriptive error messages that you can customize or use as-is.

| Validator                             | Methods                                                                                                                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stringValidator(input, ...prepares)` | `required()`, `minLength(n)`, `maxLength(n)`, `email()`, `regexp(re)`, `inArray(arr)`, `startsWith(s)`, `endsWith(s)`, `contains(s)`, `noSpace()`, `uppercase()`, `lowercase()`, `alphanumeric()`, `numeric()`, `website(mode)` |
| `numberValidator(input)`              | `required()`, `min(n)`, `max(n)`, `between(min, max)`, `integer()`, `positive()`, `negative()`, `nonNegative()`, `multipleOf(n)`, `decimal(places)`, `percentage()`                                                             |
| `arrayValidator(input)`               | `required()`, `minLength(n)`, `maxLength(n)`, `unique()`                                                                                                                                                                        |
| `dateValidator(input)`                | `required()`, `before(date)`, `after(date)`, `between(start, end)`, `past()`, `future()`, `weekday()`, `weekend()`, `minAge(years)`, `maxAge(years)`                                                                            |

### TypeScript Types

svstate exports TypeScript types to help you write type-safe external validator and effect functions. This is useful when you want to define these functions outside the `createSvState` call or reuse them across multiple state instances.

```typescript
import type { Validator, EffectContext, Snapshot, SnapshotFunction, SvStateOptions } from 'svstate';
```

| Type               | Description                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| `Validator`        | Nested object type for validation errors — leaf values are error strings (empty = valid)            |
| `EffectContext<T>` | Context object passed to effect callbacks: `{ snapshot, target, property, currentValue, oldValue }` |
| `SnapshotFunction` | Type for the `snapshot(title, replace?)` function used in effects                                   |
| `Snapshot<T>`      | Shape of a snapshot entry: `{ title: string; data: T }`                                             |
| `SvStateOptions`   | Configuration options type for `createSvState`                                                      |

**Example: External validator and effect functions**

```typescript
import { createSvState, stringValidator, type Validator, type EffectContext } from 'svstate';

// Define types for your data
type UserData = {
  name: string;
  email: string;
};

type UserErrors = {
  name: string;
  email: string;
};

// External validator function with proper typing
const validateUser = (source: UserData): UserErrors => ({
  name: stringValidator(source.name, 'trim').required().minLength(2).getError(),
  email: stringValidator(source.email, 'trim').required().email().getError()
});

// External effect function with proper typing
const userEffect = ({ snapshot, property, currentValue }: EffectContext<UserData>) => {
  console.log(`${property} changed to ${currentValue}`);
  snapshot(`Updated ${property}`);
};

// Use the external functions
const { data, state } = createSvState<UserData, UserErrors, object>(
  { name: '', email: '' },
  { validator: validateUser, effect: userEffect }
);
```

---

## 🎨 Why svstate?

| Feature                | Native Svelte 5    | svstate         |
| ---------------------- | ------------------ | --------------- |
| Simple flat objects    | ✅ Great           | ✅ Great        |
| Deep nested objects    | ⚠️ Manual tracking | ✅ Automatic    |
| Property change events | ❌ Not available   | ✅ Full context |
| Structured validation  | ❌ DIY             | ✅ Mirrors data |
| Undo/Redo              | ❌ DIY             | ✅ Built-in     |
| Dirty tracking         | ❌ DIY             | ✅ Automatic    |
| Action loading states  | ❌ DIY             | ✅ Built-in     |

**svstate is for:**

- 🏢 Enterprise applications with complex forms
- 📊 ERP, CRM, admin dashboards
- 📝 Multi-step wizards
- 🔄 Applications needing undo/redo
- ✅ Any form beyond username/password

---

## 📚 Resources

- 🎮 [Live Demo](https://bcsabaengine.github.io/svstate/) — Try it in your browser
- 📖 [Documentation](https://github.com/BCsabaEngine/svstate)
- 🐛 [Report Issues](https://github.com/BCsabaEngine/svstate/issues)
- 💬 [Discussions](https://github.com/BCsabaEngine/svstate/discussions)

---

## 📄 License

ISC © [BCsabaEngine](https://github.com/BCsabaEngine)

---

<p align="center">
  <b>Stop fighting with state. Start building features.</b>
  <br><br>
  ⭐ Star us on GitHub if svstate helps your project!
</p>
