# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**svstate** is a Svelte 5 library that provides a supercharged `$state()` with deep reactive proxies, validation, snapshot/undo, and side effects. It's designed as a peer dependency for Svelte 5 projects.

## Development Commands

**Requires Node >=20, npm >=9**

### Testing

```bash
npm test                              # Run all tests once
npm run test:coverage                 # Run tests with coverage report
npx vitest run test/validators.test.ts  # Run a single test file
npx vitest run -t "should trim"       # Run tests matching pattern
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
npm run all             # Run fix → build → test → demo:build (full validation)
npm run lint:check      # Check for linting errors
npm run lint:fix        # Auto-fix linting errors
npm run format:check    # Check code formatting
npm run format:fix      # Auto-fix formatting issues
```

### Demo

```bash
npm run demo            # Start Vite dev server with demo app (in demo/ directory)
```

## Demo Subproject

The `demo/` directory is a separate npm project for interactive testing of the library.

**Structure:**

- `demo/src/App.svelte` - Root component
- `demo/src/pages/` - Demo pages (e.g., `BasicValidation.svelte`)
- `demo/src/components/` - Shared UI components (e.g., `ErrorText.svelte`)

**Stack:** Vite + Svelte 5 + Tailwind CSS 4

**Working directly in demo:**

```bash
cd demo
npm install             # Install demo dependencies (separate from root)
npm run dev             # Start dev server
npm run build           # Production build
npm run ts:check        # TypeScript check
npm run all             # format → lint → ts:check → build
```

Note: The demo has its own `node_modules` and uses Zod for some validation examples.

## Architecture

### Core Files

- `src/index.ts` - Public exports: `createSvState`, validator builders, and snapshot types
- `src/state.svelte.ts` - Main `createSvState<T, V, P>()` function with snapshot/undo system
- `src/proxy.ts` - `ChangeProxy` deep reactive proxy implementation
- `src/validators.ts` - Fluent validator builders (string, number, array, date)

### createSvState Function (src/state.svelte.ts)

The main export creates a validated state object with snapshot/undo support:

```typescript
const { data, execute, state, rollback, reset } = createSvState(init, actuators?, options?);
```

**Returns:**

- `data` - Deep reactive proxy around the state object
- `execute(params)` - Async function to run the configured action
- `rollback(steps?)` - Undo N steps (default 1), restores state and triggers validation
- `reset()` - Return to initial snapshot, triggers validation
- `state` - Object containing reactive stores:
  - `errors: Readable<V | undefined>` - Validation errors
  - `hasErrors: Readable<boolean>` - Whether any validation errors exist
  - `isDirty: Readable<boolean>` - Whether state has been modified
  - `actionInProgress: Readable<boolean>` - Action execution status
  - `actionError: Readable<Error | undefined>` - Last action error
  - `snapshots: Readable<Snapshot<T>[]>` - Snapshot history for undo

**Actuators:**

- `validator?: (source: T) => V` - Validation function returning error structure
- `effect?: (context: EffectContext<T>) => void` - Side effect receiving context object with `snapshot` function
- `action?: (params?: P) => Promise<void> | void` - Async action to execute
- `actionCompleted?: (error?: unknown) => void | Promise<void>` - Callback after action completes (can be async)

**Options:**

- `resetDirtyOnAction: boolean` (default: `true`) - Reset `isDirty` after successful action
- `debounceValidation: number` (default: `0`) - Debounce validation by N ms (0 = `queueMicrotask`)
- `allowConcurrentActions: boolean` (default: `false`) - Ignore `execute()` if action in progress
- `persistActionError: boolean` (default: `false`) - Keep action errors until next action

### Snapshot/Undo System

The effect callback receives `EffectContext<T>` with a `snapshot` function for creating undo points:

```typescript
effect: ({ snapshot, property }) => {
  snapshot(`Changed ${property}`); // Creates snapshot with title
};
```

- `snapshot(title, replace = true)` - Creates a snapshot; if `replace=true` and last snapshot has same title, replaces it (debouncing)
- Initial state is saved as first snapshot with title `"Initial"`
- Successful action execution resets snapshots with current state as new initial
- `rollback()` and `reset()` trigger validation after restoring state

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
  - Methods: `required()`, `noSpace()`, `minLength()`, `maxLength()`, `uppercase()`, `lowercase()`, `startsWith()`, `endsWith()`, `contains()`, `regexp()`, `inArray()`, `email()`, `website(prefix?)`, `alphanumeric()`, `numeric()`
- **numberValidator(input)**
  - Methods: `required()`, `min()`, `max()`, `between()`, `integer()`, `positive()`, `negative()`, `nonNegative()`, `multipleOf()`, `decimal()`, `percentage()`
- **arrayValidator(input)**
  - Methods: `required()`, `minLength()`, `maxLength()`, `unique()`
- **dateValidator(input)**
  - Methods: `required()`, `before()`, `after()`, `between()`, `past()`, `future()`, `weekday()`, `weekend()`, `minAge()`, `maxAge()`

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

Test files go in `test/` directory:

- `*.test.ts` - Pure TypeScript tests (validators, proxy)
- `*.test.svelte.ts` - Tests using Svelte 5 features ($state runes)

Vitest is configured with:

- Globals enabled (no imports needed for `describe`, `it`, `expect`)
- Node environment
- Console output suppressed
