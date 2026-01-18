# Stores vs Runes Analysis for svstate

## Current Architecture

The library already uses a **hybrid approach**:
- `$state<T>()` for the reactive data object (line 86)
- Svelte stores (`writable`, `derived`) for metadata: errors, hasErrors, isDirty, actionInProgress, actionError, snapshots

```typescript
// Current pattern in src/state.svelte.ts
const errors = writable<V | undefined>();           // Store
const hasErrors = derived(errors, hasAnyErrors);    // Derived store
const stateObject = $state<T>(init);                // Rune for data
```

## Can You Migrate Stores to Runes?

**Technically possible, but not recommended for this library.**

### The Core Problem

Runes are compile-time constructs. When you return `$state` values from a function, consumers receive the current value, not a reactive reference:

```typescript
// Hypothetical runes-based approach
function createSvState(...) {
  let _errors = $state<V | undefined>();

  return {
    state: {
      get errors() { return _errors; }  // Getter required for reactivity
    }
  };
}

// Consumer problem:
const { state: { errors } } = createSvState(...);  // BREAKS - loses reactivity
// Must use: state.errors every time (no destructuring)
```

### What Would Break

| Feature | Current (Stores) | After Migration (Runes) |
|---------|-----------------|-------------------------|
| Destructuring | `const { errors } = state` works | Breaks reactivity |
| Template syntax | `{$errors?.name}` | `{state.errors?.name}` |
| Test reads | `get(state.errors)` | No equivalent |
| Cross-module reactivity | Works | Compiler-dependent |

## Advantages of Runes (Limited for Libraries)

- Simpler mental model for components
- Native TypeScript types (no `Readable<T>` wrapper)
- Slightly better tree-shaking

## Advantages of Stores (Significant for Libraries)

- **Universal compatibility** - Work in Svelte 3/4/5, plain JS, and tests
- **Explicit contract** - `Readable<T>` is a clear, stable API
- **Synchronous reads** - `get()` provides immediate values for internal logic
- **Destructuring works** - Consumers can extract stores and maintain reactivity
- **Easy testing** - `get()` function makes assertions straightforward

## Recommendation: Do NOT Migrate
