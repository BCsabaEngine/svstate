# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**svstate** is a Svelte 5 library that provides a supercharged `$state()` with deep reactive proxies, validation, snapshot/undo, and side effects. It's designed as a peer dependency for Svelte 5 projects.

**Module Format:** ESM (ES Modules) only — no CommonJS build is provided.

## Development Commands

**Requires Node >=20, npm >=9**

### Testing

```bash
npm test                              # Run all tests once
npm run test:coverage                 # Run tests with coverage report
npx vitest run test/validators.test.ts  # Run a single test file
npx vitest run -t "should trim"       # Run tests matching pattern
npx vitest                            # Watch mode (re-runs on file changes)
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

- `src/index.ts` - Public exports: `createSvState`, validator builders, types (`Snapshot`, `EffectContext`, `SnapshotFunction`, `SvStateOptions`, `Validator`, `AsyncValidator`, `AsyncValidatorFunction`, `AsyncErrors`, `DirtyFields`)
- `src/state.svelte.ts` - Main `createSvState<T, V, P>()` function with snapshot/undo system and async validation
- `src/proxy.ts` - `ChangeProxy` deep reactive proxy implementation
- `src/validators.ts` - Fluent validator builders (string, number, array, date)

### createSvState Function (src/state.svelte.ts)

The main export creates a validated state object with snapshot/undo support:

```typescript
const { data, execute, state, rollback, rollbackTo, reset } = createSvState(init, actuators?, options?);
```

**Returns:**

- `data` - Deep reactive proxy around the state object (methods on the object are preserved and callable)
- `execute(params)` - Async function to run the configured action
- `rollback(steps?)` - Undo N steps (default 1), restores state and triggers validation
- `rollbackTo(title)` - Roll back to the last snapshot matching `title`, returns `boolean` (true if found)
- `reset()` - Return to initial snapshot, triggers validation
- `state` - Object containing reactive stores:
  - `errors: Readable<V | undefined>` - Validation errors (sync)
  - `hasErrors: Readable<boolean>` - Whether any sync validation errors exist
  - `isDirty: Readable<boolean>` - Whether state has been modified (derived from `isDirtyByField`)
  - `isDirtyByField: Readable<DirtyFields>` - Per-field dirty tracking; keys are dot-notation property paths. When a nested field changes, all parent paths are also marked dirty (e.g., changing `customer.address.street` marks `customer.address` and `customer` as dirty). Cleared on `reset()`, `rollback()`, and successful action (respecting `resetDirtyOnAction`).
  - `actionInProgress: Readable<boolean>` - Action execution status
  - `actionError: Readable<Error | undefined>` - Last action error
  - `snapshots: Readable<Snapshot<T>[]>` - Snapshot history for undo
  - `asyncErrors: Readable<AsyncErrors>` - Async validation errors (keyed by property path)
  - `hasAsyncErrors: Readable<boolean>` - Whether any async validation errors exist
  - `asyncValidating: Readable<string[]>` - Property paths currently being validated
  - `hasCombinedErrors: Readable<boolean>` - Whether any sync OR async errors exist

**Actuators:**

- `validator?: (source: T) => V` - Sync validation function returning error structure
- `effect?: (context: EffectContext<T>) => void` - Side effect receiving context object with `snapshot` function
- `action?: (params?: P) => Promise<void> | void` - Async action to execute
- `actionCompleted?: (error?: unknown) => void | Promise<void>` - Callback after action completes (can be async)
- `asyncValidator?: AsyncValidator<T>` - Async validators keyed by property path (see Async Validation System)

**Options:**

- `resetDirtyOnAction: boolean` (default: `true`) - Reset `isDirty` after successful action
- `debounceValidation: number` (default: `0`) - Debounce sync validation by N ms (0 = `queueMicrotask`)
- `allowConcurrentActions: boolean` (default: `false`) - Ignore `execute()` if action in progress
- `persistActionError: boolean` (default: `false`) - Keep action errors until next action
- `debounceAsyncValidation: number` (default: `300`) - Debounce async validation by N ms
- `runAsyncValidationOnInit: boolean` (default: `false`) - Run async validators when state is created
- `clearAsyncErrorsOnChange: boolean` (default: `true`) - Clear async error for a path when that property changes
- `maxConcurrentAsyncValidations: number` (default: `4`) - Maximum concurrent async validators running simultaneously
- `maxSnapshots: number` (default: `50`) - Maximum number of snapshots to keep; oldest non-Initial snapshots are trimmed when exceeded. `0` = unlimited.

### Snapshot/Undo System

The effect callback receives `EffectContext<T>` with:

- `snapshot` - Function to create undo points
- `target` - The state object
- `property` - Dot-notation path of changed property
- `currentValue` / `oldValue` - The new and previous values

```typescript
effect: ({ snapshot, property }) => {
  snapshot(`Changed ${property}`); // Creates snapshot with title
};
```

**Important:** The effect callback must be synchronous. Returning a Promise throws an error.

- `snapshot(title, replace = true)` - Creates a snapshot; if `replace=true` and last snapshot has same title, replaces it (debouncing)
- Initial state is saved as first snapshot with title `"Initial"`
- Successful action execution resets snapshots with current state as new initial
- `rollback()`, `rollbackTo()`, and `reset()` trigger validation after restoring state
- `rollbackTo(title)` searches from the end to find the last matching snapshot; returns `false` if not found or only initial snapshot exists
- `maxSnapshots` option (default 50) trims oldest non-Initial snapshots via LRU; Initial snapshot (index 0) is always preserved

### Async Validation System

Async validators are defined per property path and receive an `AbortSignal` for cancellation:

```typescript
type AsyncValidatorFunction<T> = (value: unknown, source: T, signal: AbortSignal) => Promise<string>;

type AsyncValidator<T> = {
  [propertyPath: string]: AsyncValidatorFunction<T>;
};
```

**Key behaviors:**

- Async validators are keyed by dot-notation property paths (e.g., `"email"`, `"user.username"`)
- When a property changes, matching async validators are scheduled after `debounceAsyncValidation` ms
- If sync validation fails for a property path, async validation is skipped for that path
- Changing a property cancels any pending async validation for that path
- `rollback()` and `reset()` cancel all async validations and clear async errors
- The `maxConcurrentAsyncValidations` option limits how many async validators run simultaneously; additional validators are queued

**Matching rules for property paths:**

- Exact match: validator for `"email"` triggers when `email` changes
- Parent triggers child: validator for `"user.email"` triggers when `user` changes
- Child triggers parent: validator for `"user"` triggers when `user.email` changes

### Deep Clone System (src/state.svelte.ts)

The `deepClone` function preserves object prototypes using `Object.create(Object.getPrototypeOf(object))`. This allows state objects to include methods that operate on `this`:

```typescript
const createState = () => ({
  value: 0,
  format() {
    return `$${this.value.toFixed(2)}`;
  }
});

const { data } = createSvState(createState());
data.format(); // Works — method preserved
```

Methods are preserved through snapshots, rollback, and reset operations.

### Deep Proxy System (src/proxy.ts)

- `ChangeProxy<T>()` wraps objects with recursive Proxy handlers
- Tracks property paths via dot notation (e.g., `"address.zip"`)
- **Loop Prevention**: Uses strict equality (`!==`) to skip unchanged values
- Excludes non-proxiable types: Date, Map, Set, WeakMap, WeakSet, RegExp, Error, Promise
- Array indices are collapsed in paths (only named properties tracked)

### Validation System

Validation is deferred via `queueMicrotask()` (or `setTimeout` when `debounceValidation > 0`) to batch changes. The `Validator` type is a nested object where leaf values are error strings (empty = valid).

The `hasErrors` store uses `checkHasErrors` which recursively checks if any leaf strings are non-empty.

### Fluent Validator Builders (src/validators.ts)

Four chainable validator builders with `getError()` to extract the first error. All validators accept `null` or `undefined` as input (nullish values skip most validations unless `required()` or `requiredIf()` is called).

- **stringValidator(input)** - String validation
  - `.prepare(...ops)` - Preprocessing: `'trim'`, `'normalize'`, `'upper'`, `'lower'`, `'localeUpper'`, `'localeLower'`
  - `.required()`, `.requiredIf(cond)` - Require non-empty value
  - `.minLength(n)`, `.maxLength(n)` - Length constraints
  - `.noSpace()`, `.notBlank()` - Whitespace rules
  - `.uppercase()`, `.lowercase()` - Case enforcement
  - `.startsWith(s)`, `.endsWith(s)`, `.contains(s)` - Content matching
  - `.regexp(re, msg?)` - Custom regex validation
  - `.in(values)`, `.notIn(values)` - Allowed/disallowed values (accepts array or object keys)
  - `.email()`, `.website(mode?)` - Format validators
  - `.alphanumeric()`, `.numeric()`, `.slug()`, `.identifier()` - Pattern validators

- **numberValidator(input)** - Numeric validation
  - `.required()`, `.requiredIf(cond)` - Require non-NaN value
  - `.min(n)`, `.max(n)`, `.between(min, max)` - Range constraints
  - `.integer()`, `.decimal(places)` - Type constraints
  - `.positive()`, `.negative()`, `.nonNegative()`, `.notZero()` - Sign constraints
  - `.multipleOf(n)`, `.step(n)` - Divisibility checks
  - `.percentage()` - Must be 0-100

- **arrayValidator(input)** - Array validation
  - `.required()`, `.requiredIf(cond)` - Require non-empty array
  - `.minLength(n)`, `.maxLength(n)`, `.ofLength(n)` - Length constraints
  - `.unique()` - All items must be unique
  - `.includes(item)`, `.includesAny(items)`, `.includesAll(items)` - Item presence

- **dateValidator(input)** - Date validation (accepts Date, string, or number)
  - `.required()`, `.requiredIf(cond)` - Require valid date
  - `.before(date)`, `.after(date)`, `.between(start, end)` - Range constraints
  - `.past()`, `.future()` - Relative to now
  - `.weekday()`, `.weekend()` - Day of week
  - `.minAge(years)`, `.maxAge(years)` - Age calculations

## Code Style

### ESLint Rules

- Import sorting enforced via `eslint-plugin-simple-import-sort`
- Unicorn plugin enabled (most rules) with exceptions: `filename-case`, `no-array-reduce`, `no-nested-ternary` off
- Curly braces: `"multi"` style (required only for multi-line blocks)
- `no-alert`, `no-debugger` are errors

### TypeScript

- Target: ESNext with ESM (ES Modules)
- Strict mode with: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noUncheckedIndexedAccess`

## Testing

Test files go in `test/` directory:

- `*.test.ts` - Pure TypeScript tests (validators, proxy)
- `*.test.svelte.ts` - Tests using Svelte 5 runes (`$state`, `$derived`, etc.)

Vitest is configured with:

- Globals enabled (no imports needed for `describe`, `it`, `expect`)
- Node environment
- Console output suppressed

## Svelte 5 Runes Mode

Files with `.svelte.ts` extension use Svelte 5 runes mode, allowing `$state()`, `$derived()`, and other runes outside of `.svelte` components. The main state logic in `src/state.svelte.ts` uses this pattern.
