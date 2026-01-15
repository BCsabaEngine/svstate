# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**svstate** is a Svelte 5 library that provides a supercharged `$state()` with deep reactive proxies, validation, and side effects. It's designed as a peer dependency for Svelte 5 projects.

## Development Commands

### Testing

```bash
npm test                 # Run all tests once
npm run test:coverage    # Run tests with coverage report
```

Coverage thresholds are set at 60% for lines, functions, branches, and statements.

### Building

```bash
npm run build           # Clean build (tsc --build --clean && --force)
npm run clean           # Clean TypeScript build artifacts
```

### Code Quality

```bash
npm run fix             # Run format → lint → format (recommended)
npm run all             # Run fix → build → test (full validation)
npm run lint:check      # Check for linting errors
npm run lint:fix        # Auto-fix linting errors
npm run format:check    # Check code formatting
npm run format:fix      # Auto-fix formatting issues
```

### Demo

```bash
npm run demo            # Start Vite dev server with demo app (in demo/ directory)
```

## Architecture

### Core Files

- `src/index.ts` - Public exports: `createSvState` and validator builders
- `src/state.svelte.ts` - Main `createSvState<T, V, P>()` function
- `src/proxy.ts` - `ChangeProxy` deep reactive proxy implementation
- `src/validators.ts` - Fluent validator builders (string, number, array, date)

### createSvState Function (src/state.svelte.ts)

The main export creates a validated state object with the following structure:

```typescript
const { data, execute, state } = createSvState(init, actuators?, options?);
```

**Returns:**

- `data` - Deep reactive proxy around the state object
- `execute(params)` - Async function to run the configured action
- `state` - Object containing reactive stores:
  - `errors: Readable<V | undefined>` - Validation errors
  - `hasErrors: Readable<boolean>` - Whether any validation errors exist
  - `isDirty: Readable<boolean>` - Whether state has been modified
  - `actionInProgress: Readable<boolean>` - Action execution status
  - `actionError: Readable<Error | undefined>` - Last action error

**Actuators:**

- `validator?: (source: T) => V` - Validation function returning error structure
- `effect?: ProxyChanged<T>` - Side effect on any property change
- `action?: (params: P) => Promise<void> | void` - Async action to execute
- `actionCompleted?: (error?: unknown) => void` - Callback after action completes

**Options:**

- `resetDirtyOnAction: boolean` (default: `true`) - Reset `isDirty` after successful action
- `debounceValidation: number` (default: `0`) - Debounce validation by N ms (0 = `queueMicrotask`)
- `allowConcurrentActions: boolean` (default: `false`) - Ignore `execute()` if action in progress
- `persistActionError: boolean` (default: `false`) - Keep action errors until next action

### Deep Proxy System (src/proxy.ts)

- `ChangeProxy<T>()` wraps objects with recursive Proxy handlers
- Tracks property paths via dot notation (e.g., `"address.zip"`)
- **Loop Prevention**: Uses strict equality (`!==`) to skip unchanged values (line 34)
- Excludes non-proxiable types: Date, Map, Set, WeakMap, WeakSet, RegExp, Error, Promise
- Array indices are collapsed in paths (only named properties tracked)

### Validation System

Validation is deferred via `queueMicrotask()` (or `setTimeout` when `debounceValidation > 0`) to batch changes. The `Validator` type is a nested object where leaf values are error strings (empty = valid).

The `hasErrors` store uses `checkHasErrors` which recursively checks if any leaf strings are non-empty.

### Fluent Validator Builders (src/validators.ts)

Four chainable validator builders with `getError()` to extract the first error:

- **stringValidator(input, ...prepares)** - Preprocessing options: `trim`, `normalize`, `upper`, `lower`
  - Methods: `required()`, `noSpace()`, `minLength()`, `maxLength()`, `uppercase()`, `lowercase()`, `startsWith()`, `regexp()`, `inArray()`
- **numberValidator(input)**
  - Methods: `required()`, `min()`, `max()`, `between()`, `integer()`, `positive()`, `negative()`, `nonNegative()`, `multipleOf()`
- **arrayValidator(input)**
  - Methods: `required()`, `minLength()`, `maxLength()`, `unique()`
- **dateValidator(input)**
  - Methods: `required()`, `before()`, `after()`, `between()`, `past()`, `future()`

## Code Style

### ESLint Rules

- Import sorting enforced via `eslint-plugin-simple-import-sort`
- Unicorn plugin enabled (most rules) with exceptions: `filename-case`, `no-array-reduce`, `no-nested-ternary` off
- Curly braces: `"multi"` style (required only for multi-line blocks)
- `no-alert`, `no-debugger` are errors

### TypeScript

- Target: ESNext with CommonJS modules
- Strict mode with: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noUncheckedIndexedAccess`

## Testing

Tests go in `test/**/*.test.ts`. Vitest is configured with:

- Globals enabled (no imports needed for `describe`, `it`, `expect`)
- Node environment
- Console output suppressed
