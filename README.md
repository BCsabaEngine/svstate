# 🚀 svstate

### Supercharged `$state()` for Svelte 5

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)
[![Svelte 5](https://img.shields.io/badge/Svelte-5-orange.svg)](https://svelte.dev/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Tests](https://img.shields.io/badge/tests-500%2B-brightgreen.svg)]()
[![Coverage](https://img.shields.io/badge/coverage-%3E98%25-brightgreen.svg)]()

> **Deep reactive proxy with validation, snapshot/undo, side effects, and plugins — built for complex, real-world applications.**

<p align="center">
  <img src="svstate.png" alt="svstate" />
</p>

<p align="center">
  <a href="https://bcsabaengine.github.io/svstate/"><strong>🎮 Live Demo</strong></a> ·
  <a href="#-installation">Installation</a> ·
  <a href="#-core-features">Features</a> ·
  <a href="#7%EF%B8%8F%E2%83%A3-plugins--extend-with-reusable-behaviors">Plugins</a> ·
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
- 🌐 **Async validation** for server-side checks (username availability, email verification)
- ⚡ **Fires effects** when any property changes (with full context)
- ⏪ **Snapshots & undo** for complex editing workflows
- 🎯 **Tracks dirty state** automatically (per-field and aggregate)
- 🔧 **Supports methods** on state objects for computed values and formatting
- 🔌 **Plugin system** for persistence, autosave, devtools, URL sync, cross-tab sync, undo/redo, and analytics

```typescript
import { createSvState, stringValidator, numberValidator } from 'svstate';

const { data, state, rollback, rollbackTo, reset, execute } = createSvState(customer, {
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
      email: stringValidator(source.email)
        .prepare('trim') // preprocessing applied before validation
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
- 🧹 String preprocessing via `.prepare()`: `'trim'`, `'normalize'`, `'upper'`, `'lower'`, `'localeUpper'`, `'localeLower'`
- ⚡ First-error-wins: `getError()` returns the first failure
- 🔀 Conditional validation: `requiredIf(condition)` on all validators

#### Async Validation

For server-side validation (checking username availability, email verification, etc.), svstate supports async validators that run after sync validation passes:

```typescript
import { createSvState, stringValidator, type AsyncValidator } from 'svstate';

type UserForm = { username: string; email: string };

const asyncValidators: AsyncValidator<UserForm> = {
  username: async (value, source, signal) => {
    // Skip if empty (let sync validation handle required)
    if (!value) return '';

    const response = await fetch(`/api/check-username?name=${value}`, { signal });
    const { available } = await response.json();
    return available ? '' : 'Username already taken';
  },
  email: async (value, source, signal) => {
    if (!value) return '';

    const response = await fetch(`/api/check-email?email=${value}`, { signal });
    const { valid } = await response.json();
    return valid ? '' : 'Email not deliverable';
  }
};

const {
  data,
  state: { errors, asyncErrors, asyncValidating, hasAsyncErrors, hasCombinedErrors }
} = createSvState(
  { username: '', email: '' },
  {
    validator: (source) => ({
      username: stringValidator(source.username).required().minLength(3).getError(),
      email: stringValidator(source.email).required().email().getError()
    }),
    asyncValidator: asyncValidators
  },
  { debounceAsyncValidation: 500 }
);

// In template:
// {#if $asyncValidating.includes('username')}Checking...{/if}
// {#if $asyncErrors.username}{$asyncErrors.username}{/if}
// <button disabled={$hasCombinedErrors}>Submit</button>
```

**Key features:**

- 🌐 Async validators receive `AbortSignal` for automatic cancellation
- ⏱️ Debounced by default (300ms) to avoid excessive API calls
- 🔄 Auto-cancels on property change or new validation
- 🚫 Skipped if sync validation fails for the same path
- 🎯 `asyncValidating` shows which paths are currently checking
- 🔒 `maxConcurrentAsyncValidations` limits parallel requests (default: 4)

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
  rollbackTo,
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

// Roll back to a named snapshot (returns true if found)
rollbackTo('Changed email');

// Roll back to initial state by name
rollbackTo('Initial');

// Reset to initial state
reset();

// Show history
$snapshots.forEach((s, i) => console.log(`${i}: ${s.title}`));
```

**Key features:**

- 📸 `snapshot(title, replace?)` — create undo points
- ⏪ `rollback(steps)` — undo N changes
- 🏷️ `rollbackTo(title)` — jump to a named snapshot
- 🔄 `reset()` — return to initial state
- 📜 `snapshots` store — access full history
- 🔀 Smart deduplication: same title replaces previous snapshot
- 📏 `maxSnapshots` option — LRU trimming to prevent unbounded growth

---

### 5️⃣ Options — Fine-Tune Behavior

Customize svstate behavior with options:

```typescript
const { data } = createSvState(formData, actuators, {
  // Reset isDirty after successful action (default: true)
  resetDirtyOnAction: true,

  // Debounce sync validation in ms (default: 0 = microtask)
  debounceValidation: 300,

  // Allow concurrent action executions (default: false)
  allowConcurrentActions: false,

  // Keep actionError until next action (default: false)
  persistActionError: false,

  // Debounce async validation in ms (default: 300)
  debounceAsyncValidation: 500,

  // Run async validators on state creation (default: false)
  runAsyncValidationOnInit: false,

  // Clear async error when property changes (default: true)
  clearAsyncErrorsOnChange: true,

  // Max concurrent async validators (default: 4)
  maxConcurrentAsyncValidations: 4,

  // Max snapshots to keep, 0 = unlimited (default: 50)
  maxSnapshots: 50,

  // Plugins to extend behavior (default: [])
  plugins: [persistPlugin({ key: 'my-form' })]
});
```

| Option                          | Default | Description                                |
| ------------------------------- | ------- | ------------------------------------------ |
| `resetDirtyOnAction`            | `true`  | Clear dirty flag after successful action   |
| `debounceValidation`            | `0`     | Delay sync validation (0 = next microtask) |
| `allowConcurrentActions`        | `false` | Block execute() while action runs          |
| `persistActionError`            | `false` | Clear error on next change or action       |
| `debounceAsyncValidation`       | `300`   | Delay async validation in ms               |
| `runAsyncValidationOnInit`      | `false` | Run async validators on creation           |
| `clearAsyncErrorsOnChange`      | `true`  | Clear async error when property changes    |
| `maxConcurrentAsyncValidations` | `4`     | Max concurrent async validators            |
| `maxSnapshots`                  | `50`    | Max snapshots to keep (0 = unlimited)      |
| `plugins`                       | `[]`    | Array of plugins to extend behavior        |

---

### 6️⃣ State Objects with Methods

State objects can include methods that operate on `this`. Methods are preserved through snapshots and undo operations, making it easy to encapsulate computed values and formatting logic:

```typescript
import { createSvState, numberValidator } from 'svstate';

// Define state with methods
type InvoiceData = {
  unitPrice: number;
  quantity: number;
  subtotal: number;
  tax: number;
  total: number;
  calculateTotals: (taxRate?: number) => void;
  formatCurrency: (value: number) => string;
};

const createInvoice = (): InvoiceData => ({
  unitPrice: 0,
  quantity: 1,
  subtotal: 0,
  tax: 0,
  total: 0,
  calculateTotals(taxRate = 0.08) {
    this.subtotal = this.unitPrice * this.quantity;
    this.tax = this.subtotal * taxRate;
    this.total = this.subtotal + this.tax;
  },
  formatCurrency(value: number) {
    return `$${value.toFixed(2)}`;
  }
});

const {
  data,
  state: { errors }
} = createSvState(createInvoice(), {
  validator: (source) => ({
    unitPrice: numberValidator(source.unitPrice).required().positive().getError(),
    quantity: numberValidator(source.quantity).required().integer().min(1).getError()
  }),
  effect: ({ property }) => {
    // Call method directly on state when inputs change
    if (property === 'unitPrice' || property === 'quantity') {
      data.calculateTotals();
    }
  }
});

// In template: use methods for formatting
// {data.formatCurrency(data.subtotal)} → "$99.00"
// {data.formatCurrency(data.total)} → "$106.92"
```

**Key features:**

- 🔧 Methods can modify `this` properties (triggers validation/effects)
- 📸 Methods preserved through `rollback()` and `reset()`
- 🎯 Call methods from effects to compute derived values
- 📐 Encapsulate formatting and business logic in state object

---

### 7️⃣ Plugins — Extend with Reusable Behaviors

svstate includes a plugin system that lets you hook into every stage of the state lifecycle. Plugins are passed via the `plugins` option and can react to changes, snapshots, actions, rollbacks, and more.

```typescript
import { createSvState, persistPlugin, devtoolsPlugin, autosavePlugin } from 'svstate';

const { data, destroy } = createSvState(formData, actuators, {
  plugins: [
    persistPlugin({ key: 'customer-form', throttle: 500 }),
    autosavePlugin({ save: (data) => api.saveDraft(data), idle: 2000 }),
    devtoolsPlugin({ name: 'CustomerForm' })
  ]
});

// Call destroy() when done (e.g., in onDestroy) to clean up plugin resources
destroy();
```

#### Built-in Plugins

**`persistPlugin`** — Persist state to localStorage (or custom storage) with throttled writes.

```typescript
import { persistPlugin } from 'svstate';

const persist = persistPlugin({
  key: 'my-form', // Required: storage key
  storage: localStorage, // Custom storage backend (default: localStorage)
  throttle: 300, // Write debounce ms (default: 300)
  version: 1, // Schema version (default: 1)
  migrate: (data, v) => data, // Migration on version mismatch
  include: ['name', 'email'], // Only persist these paths
  exclude: ['password'] // Exclude these paths
});

// Extra methods:
persist.isRestored(); // Was state hydrated from storage?
persist.clearPersistedState(); // Remove stored data
```

**`autosavePlugin`** — Auto-save after idle period or on interval.

```typescript
import { autosavePlugin } from 'svstate';

const autosave = autosavePlugin({
  save: (data) => fetch('/api/draft', { method: 'POST', body: JSON.stringify(data) }),
  idle: 1000, // Save after 1s of inactivity (default: 1000)
  interval: 30000, // Also save every 30s (default: 0 = disabled)
  saveOnDestroy: true, // Save on cleanup (default: true)
  onlyWhenDirty: true, // Skip if unchanged (default: true)
  onVisibilityHidden: false, // Save when tab goes hidden (default: false)
  onError: (err) => console.error(err)
});

// Extra methods:
await autosave.saveNow(); // Trigger immediate save
autosave.isSaving(); // Is a save in progress?
```

**`devtoolsPlugin`** — Log all state events to the browser console.

```typescript
import { devtoolsPlugin } from 'svstate';

devtoolsPlugin({
  name: 'MyForm', // Log prefix (default: 'svstate')
  collapsed: true, // Use groupCollapsed (default: true)
  logValidation: false, // Log validation results (default: false)
  enabled: true, // Auto-disabled in production
  logValues: false // Log raw state values in change events (default: false — avoids leaking passwords/tokens)
});
```

**`historyPlugin`** — Sync state fields to/from URL search parameters.

```typescript
import { historyPlugin } from 'svstate';

const history = historyPlugin({
  fields: { search: 'q', page: 'p' }, // { stateField: 'urlParam' }
  mode: 'replace', // 'push' | 'replace' (default: 'replace')
  serialize: (value) => String(value),
  deserialize: (param) => param
});

// Extra method:
history.syncFromUrl(); // Manually re-read URL into state
```

**`syncPlugin`** — Sync state across browser tabs via BroadcastChannel.

```typescript
import { syncPlugin } from 'svstate';

const sync = syncPlugin({
  key: 'my-form-sync', // Required: channel name
  throttle: 100, // Broadcast debounce ms (default: 100)
  merge: 'overwrite' // 'overwrite' | 'ignore' (default: 'overwrite')
});

// Extra method:
sync.disconnect(); // Close the channel
```

**`undoRedoPlugin`** — Adds redo capability on top of built-in rollback.

```typescript
import { undoRedoPlugin } from 'svstate';

const undoRedo = undoRedoPlugin<MyState>({
  maxRedoStack: 50 // Cap redo stack size (default: unlimited)
});

// Extra methods and stores:
undoRedo.redo(); // Re-apply last undone change
undoRedo.canRedo(); // Are there redo states?
undoRedo.redoStack; // Readable<Snapshot<T>[]> — reactive redo history
```

**`analyticsPlugin`** — Buffer and batch state events for analytics.

```typescript
import { analyticsPlugin } from 'svstate';

analyticsPlugin({
  onFlush: (events) => sendToAnalytics(events), // Required
  batchSize: 20, // Flush at N events (default: 20)
  flushInterval: 5000, // Periodic flush ms (default: 5000)
  include: ['change', 'action'], // Filter event types
  redact: ['password', 'creditCard'] // Replace values for these paths with '[redacted]'
});
```

#### Writing Custom Plugins

Implement the `SvStatePlugin<T>` interface — all hooks are optional:

```typescript
import type { SvStatePlugin } from 'svstate';

const myPlugin: SvStatePlugin<MyState> = {
  name: 'my-plugin',
  onInit(context) {
    // Access context.data, context.state, context.options, context.snapshot
    console.log('State initialized with', Object.keys(context.data));
  },
  onChange(event) {
    console.log(`${event.property}: ${event.oldValue} → ${event.currentValue}`);
  },
  onAction(event) {
    if (event.phase === 'before') console.log('Action starting...');
    if (event.phase === 'after') console.log('Action done', event.error || 'success');
  },
  destroy() {
    // Cleanup resources
  }
};
```

**Available hooks:** `onInit`, `onChange`, `onValidation`, `onSnapshot`, `onAction`, `onRollback`, `onReset`, `destroy`

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
    name: stringValidator(source.name)
      .prepare('trim')
      .required()
      .minLength(2)
      .maxLength(100)
      .getError(),

    taxId: stringValidator(source.taxId)
      .prepare('trim', 'upper')
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
      street: stringValidator(source.address.street)
        .prepare('trim')
        .required()
        .minLength(5)
        .getError(),
      city: stringValidator(source.address.city)
        .prepare('trim')
        .required()
        .getError(),
      zip: stringValidator(source.address.zip)
        .prepare('trim')
        .required()
        .minLength(5)
        .getError(),
      country: stringValidator(source.address.country)
        .required()
        .in(['US', 'CA', 'UK', 'DE', 'FR'])
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
        .in(['NET15', 'NET30', 'NET60', 'COD'])
        .getError(),
      currency: stringValidator(source.billing.currency)
        .required()
        .in(['USD', 'EUR', 'GBP'])
        .getError(),
      bankAccount: {
        iban: stringValidator(source.billing.bankAccount.iban)
          .prepare('trim', 'upper')
          .required()
          .minLength(15)
          .maxLength(34)
          .getError(),
        swift: stringValidator(source.billing.bankAccount.swift)
          .prepare('trim', 'upper')
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
    sku: stringValidator(source.sku)
      .prepare('trim', 'upper')
      .required()
      .regexp(/^[A-Z]{3}-\d{4}$/, 'Format: ABC-1234')
      .getError(),

    name: stringValidator(source.name)
      .prepare('trim')
      .required()
      .minLength(3)
      .maxLength(100)
      .getError(),

    description: stringValidator(source.description)
      .prepare('trim')
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
| `data` | `T` | Deep reactive proxy — bind directly, methods preserved |
| `execute(params?)` | `(P?) => Promise<void>` | Run the configured action |
| `rollback(steps?)` | `(n?: number) => void` | Undo N changes (default: 1) |
| `rollbackTo(title)` | `(title: string) => boolean` | Roll back to last snapshot with matching title |
| `reset()` | `() => void` | Return to initial state |
| `destroy()` | `() => void` | Cleanup plugins and cancel async validations |
| `state.errors` | `Readable<V>` | Sync validation errors store |
| `state.hasErrors` | `Readable<boolean>` | Has sync errors? |
| `state.isDirty` | `Readable<boolean>` | Has state changed? (derived from `isDirtyByField`) |
| `state.isDirtyByField` | `Readable<DirtyFields>` | Per-field dirty tracking (dot-notation paths) |
| `state.actionInProgress` | `Readable<boolean>` | Is action running? |
| `state.actionError` | `Readable<Error>` | Last action error |
| `state.snapshots` | `Readable<Snapshot[]>` | Undo history |
| `state.asyncErrors` | `Readable<AsyncErrors>` | Async validation errors (keyed by path) |
| `state.hasAsyncErrors` | `Readable<boolean>` | Has async errors? |
| `state.asyncValidating` | `Readable<string[]>` | Paths currently validating |
| `state.hasCombinedErrors` | `Readable<boolean>` | Has sync OR async errors? |

### Built-in Validators

svstate ships with four fluent validator builders that cover the most common validation scenarios. Each validator uses a chainable API — call validation methods in sequence and finish with `getError()` to retrieve the first error message (or an empty string if valid).

String validators support optional preprocessing (`'trim'`, `'normalize'`, `'upper'`, `'lower'`) applied before validation. All validators return descriptive error messages that you can customize or use as-is.

| Validator                | Methods                                                                                                                                                                                                                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stringValidator(input)` | `prepare(...ops)`, `required()`, `requiredIf(cond)`, `minLength(n)`, `maxLength(n)`, `email()`, `regexp(re, msg?)`, `in(arr)`, `notIn(arr)`, `startsWith(s)`, `endsWith(s)`, `contains(s)`, `noSpace()`, `notBlank()`, `uppercase()`, `lowercase()`, `alphanumeric()`, `numeric()`, `slug()`, `identifier()`, `website(mode)` |
| `numberValidator(input)` | `required()`, `requiredIf(cond)`, `min(n)`, `max(n)`, `between(min, max)`, `integer()`, `positive()`, `negative()`, `nonNegative()`, `notZero()`, `multipleOf(n)`, `step(n)`, `decimal(places)`, `percentage()`                                                                                                               |
| `arrayValidator(input)`  | `required()`, `requiredIf(cond)`, `minLength(n)`, `maxLength(n)`, `ofLength(n)`, `unique()`, `includes(item)`, `includesAny(items)`, `includesAll(items)`                                                                                                                                                                     |
| `dateValidator(input)`   | `required()`, `requiredIf(cond)`, `before(date)`, `after(date)`, `between(start, end)`, `past()`, `future()`, `weekday()`, `weekend()`, `minAge(years)`, `maxAge(years)`                                                                                                                                                      |

### TypeScript Types

svstate exports TypeScript types to help you write type-safe external validator and effect functions. This is useful when you want to define these functions outside the `createSvState` call or reuse them across multiple state instances.

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
  DirtyFields,
  SvStatePlugin,
  PluginContext,
  PluginStores,
  ChangeEvent,
  ActionEvent
} from 'svstate';
```

| Type                        | Description                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| `Validator`                 | Nested object type for validation errors — leaf values are error strings (empty = valid)            |
| `EffectContext<T>`          | Context object passed to effect callbacks: `{ snapshot, target, property, currentValue, oldValue }` |
| `SnapshotFunction`          | Type for the `snapshot(title, replace?)` function used in effects                                   |
| `Snapshot<T>`               | Shape of a snapshot entry: `{ title: string; data: T }`                                             |
| `SvStateOptions`            | Configuration options type for `createSvState`                                                      |
| `AsyncValidator<T>`         | Object mapping property paths to async validator functions                                          |
| `AsyncValidatorFunction<T>` | Async function: `(value, source, signal) => Promise<string>`                                        |
| `AsyncErrors`               | Object mapping property paths to error strings                                                      |
| `DirtyFields`               | Object mapping dot-notation property paths to `boolean` dirty status                                |
| `SvStatePlugin<T>`          | Plugin interface with lifecycle hooks (`onInit`, `onChange`, `onAction`, etc.)                      |
| `PluginContext<T>`          | Context passed to `onInit`: `{ data, state, options, snapshot }`                                    |
| `PluginStores<T>`           | All readable stores exposed to plugins                                                              |
| `ChangeEvent<T>`            | Payload for `onChange`: `{ target, property, currentValue, oldValue }`                              |
| `ActionEvent`               | Payload for `onAction`: `{ phase, params?, error? }`                                                |

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

| Feature                | Native Svelte 5    | svstate                  |
| ---------------------- | ------------------ | ------------------------ |
| Simple flat objects    | ✅ Great           | ✅ Great                 |
| Deep nested objects    | ⚠️ Manual tracking | ✅ Automatic             |
| Property change events | ❌ Not available   | ✅ Full context          |
| Structured validation  | ❌ DIY             | ✅ Mirrors data          |
| Async validation       | ❌ DIY             | ✅ Built-in              |
| Undo/Redo              | ❌ DIY             | ✅ Built-in              |
| Dirty tracking         | ❌ DIY             | ✅ Automatic (per-field) |
| Action loading states  | ❌ DIY             | ✅ Built-in              |
| State with methods     | ⚠️ Manual cloning  | ✅ Automatic             |
| Plugin ecosystem       | ❌ Not available   | ✅ 7 built-in plugins    |

**svstate is for:**

- 🏢 Enterprise applications with complex forms
- 📊 ERP, CRM, admin dashboards
- 📝 Multi-step wizards
- 🔄 Applications needing undo/redo
- ✅ Any form beyond username/password

---

## 📚 Resources

- 🎮 [Live Demo](https://bcsabaengine.github.io/svstate/) — Try it in your browser
- 🛠️ [SvelteKit Example](https://github.com/BCsabaEngine/svstate-kit) — Example SvelteKit application using svstate
- 📖 [Documentation](https://github.com/BCsabaEngine/svstate)
- ❓ [FAQ](FAQ.md) — Common questions and troubleshooting
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
