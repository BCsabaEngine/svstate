# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**svstate** is a Svelte 5 library that provides a supercharged `$state()` with deep reactive proxies, validation, snapshot/undo, and side effects. It's designed as a peer dependency for Svelte 5 projects.

**Module Format:** ESM (ES Modules) only — no CommonJS build is provided.

## Development Commands

**Requires Node >=22, npm >=9**

`npm run fix` runs format → lint → format (use after edits); `npm run all` is the full validation (fix → build → test → demo:build). Single test file: `npx vitest run test/validators.test.ts`; by name: `npx vitest run -t "should trim"`.

## Demo Subproject

`demo/` is a separate npm project (own `node_modules`); see `demo/CLAUDE.md` when working there.

## Documentation Files

- `README.md` - Main documentation: features, API reference, examples, plugin guide
- `FAQ.md` - Frequently asked questions: common patterns, troubleshooting, Zod integration, per-field dirty tracking
- `demo/public/llms.txt` - LLM-oriented documentation with demo page descriptions and code snippets. This is the source: `npm run demo:build` copies it to `docs/llms.txt` (the build empties `docs/`), so never edit `docs/llms.txt` directly

## Architecture

### Core Files

- `src/index.ts` - Public exports: `createSvState`, validator builders, plugin types and built-in plugins, and the public types
- `src/state.svelte.ts` - Main `createSvState<T, V, P>()` function with snapshot/undo system, async validation, and plugin integration
- `src/proxy.ts` - `ChangeProxy` deep reactive proxy implementation
- `src/validators.ts` - Fluent validator builders (string, number, array, date)
- `src/plugin.ts` - Plugin type definitions (`SvStatePlugin`, `PluginContext`, `PluginStores`, `ChangeEvent`, `ActionEvent`). `PluginStores<T>` is an alias of `StateResult<T, Validator>` — the same stores `createSvState` returns, with the error type widened
- `src/internal/` - Internal helpers shared by the core and the plugins, not exported publicly:
  - `clone.ts` — `deepClone` (prototype-preserving, reconstructs `Map`/`Set`/`RegExp`, handles cycles)
  - `paths.ts` — `DANGEROUS_KEYS`, `getValueAtPath`, `setValueAtPath`, `isPlainObject`, `safeMerge`, `safeDeepMerge`, `asRecord`, `getMatchingPaths`
  - `errors.ts` — `hasAnyErrors`, `toError`
  - `diff.ts` — `isDeepEqual`, `getChangedPaths` (dirty-field recomputation after rollback)
  - `timers.ts` — `createDebouncer` (trailing-edge debounce with `schedule`/`cancel`/`flush`/`isPending`), shared by `persist`, `autosave` and `sync`
- `src/plugins/` - Built-in plugins: `persistPlugin`, `autosavePlugin`, `devtoolsPlugin`, `historyPlugin`, `syncPlugin`, `undoRedoPlugin`, `analyticsPlugin`

### createSvState Function (src/state.svelte.ts)

The main export creates a validated state object with snapshot/undo support:

```typescript
const { data, execute, state, rollback, rollbackTo, reset, destroy, validate, batch } = createSvState(init, actuators?, options?);
```

**Returns:**

- `data` - Deep reactive proxy around the state object (methods on the object are preserved and callable)
- `execute(params)` - Async function to run the configured action
- `rollback(steps?)` - Undo N steps (default 1), restores state and triggers validation
- `rollbackTo(title)` - Roll back to the last snapshot matching `title`, returns `boolean` (true if found)
- `reset()` - Return to initial snapshot, triggers validation
- `destroy()` - Cleanup function: cancels in-flight and debounced async validations, clears the pending validation timer, ignores later mutations, then calls plugin `destroy` hooks in reverse order. Idempotent.
- `validate()` - Runs sync validation immediately (bypassing debounce) and returns `ValidationResult<V>` = `{ errors, hasErrors }`
- `batch(fn)` - Applies `fn(draft)` as one unit: one validation pass, each async validator scheduled at most once, and a single snapshot for the whole batch (titled and `shouldReplace`d after the first `snapshot()` call made inside it). `effect` and plugin `onChange` still fire per mutation. Nested `batch()` calls join the outer batch.
- `state` - Object containing reactive stores:
  - `errors: Readable<V | undefined>` - Validation errors (sync)
  - `hasErrors: Readable<boolean>` - Whether any sync validation errors exist
  - `isDirty: Readable<boolean>` - Whether state has been modified (derived from `isDirtyByField`)
  - `isDirtyByField: Readable<DirtyFields>` - Per-field dirty tracking; keys are dot-notation property paths. When a nested field changes, all parent paths are also marked dirty (e.g., changing `customer.address.street` marks `customer.address` and `customer` as dirty). Cleared on `reset()` and successful action (respecting `resetDirtyOnAction`); `rollback()`/`rollbackTo()` recompute it against the Initial snapshot (`getChangedPaths` in `src/internal/diff.ts`), so fields still differing from it stay dirty.
  - `actionInProgress: Readable<boolean>` - Action execution status
  - `actionError: Readable<Error | undefined>` - Last action error; anything thrown is wrapped into an `Error` by reading `.message` then `.body.message` before falling back to `String()` (primitives included)
  - `snapshots: Readable<Snapshot<T>[]>` - Snapshot history for undo
  - `asyncErrors: Readable<AsyncErrors>` - Async validation errors (keyed by property path)
  - `hasAsyncErrors: Readable<boolean>` - Whether any async validation errors exist
  - `asyncValidating: Readable<string[]>` - Property paths currently being validated
  - `hasCombinedErrors: Readable<boolean>` - Whether any sync OR async errors exist

**Actuators:**

- `validator?: (source: T) => V` - Sync validation function returning error structure
- `effect?: (context: EffectContext<T>) => void` - Side effect receiving context object with `snapshot` function
- `pathEffect?: PathEffect<T>` - Effects keyed by property path (same matching rules as `asyncValidator`: exact, descendant or ancestor); run after `effect` with the same context and the same synchronous requirement
- `action?: (params?: P) => Promise<void> | void` - Async action to execute
- `actionCompleted?: (error?: unknown) => void | Promise<void>` - Callback after action completes (can be async). Runs exactly once per `execute()`: with the raw thrown value on failure, with no argument on success; a throw from it is reported through `actionError` (the action's own error wins). `actionInProgress` is counted, so with `allowConcurrentActions` it stays `true` until every running action finished.
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
- `onPluginError: (error, pluginName, hook) => void` (default: `console.error`) - Called when a plugin hook throws; the mutation and the remaining plugins are unaffected
- `plugins: SvStatePlugin<any>[]` (default: `[]`) - Array of plugins to extend behavior (see Plugin System)

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

**Important:** The effect callback (and every `pathEffect` callback) must be synchronous. Returning a Promise throws an error. The write has already happened when an effect runs, so if an effect throws, plugin `onChange`, dirty tracking and validation/async scheduling still run (in a `finally`) and the error is rethrown to the writer.

- `snapshot(title, shouldReplace = true)` - Creates a snapshot; if `shouldReplace=true` and last snapshot has same title, replaces it (debouncing)
- Initial state is saved as first snapshot with title `"Initial"`
- Successful action execution resets snapshots with current state as new initial
- `rollback()`, `rollbackTo()`, and `reset()` trigger validation after restoring state
- `rollbackTo(title)` searches from the end to find the last matching snapshot; returns `false` if not found or only initial snapshot exists
- Every snapshot is a full `deepClone` of the state, so memory/CPU scale with tree size × `maxSnapshots`
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
- `rollback()` and `reset()` cancel all async validations and clear async errors, then re-schedule validators for values still differing from the initial state (all of them on `reset()` when `runAsyncValidationOnInit` is set)
- The `maxConcurrentAsyncValidations` option limits how many async validators run simultaneously; additional validators are queued

**Matching rules for property paths:**

- Exact match: validator for `"email"` triggers when `email` changes
- Parent triggers child: validator for `"user.email"` triggers when `user` changes
- Child triggers parent: validator for `"user"` triggers when `user.email` changes

### Plugin System (src/plugin.ts, src/plugins/)

Plugins extend `createSvState` via lifecycle hooks. They are registered via `options.plugins` array.

**`SvStatePlugin<T>` interface:**

- `name: string` - Required unique identifier
- `onInit?(context: PluginContext<T>)` - Called once after state is fully initialized
- `onChange?(event: ChangeEvent<T>)` - Called on every property mutation (`{ target, property, currentValue, oldValue }`)
- `onValidation?(errors: Validator | undefined)` - Called after sync validation runs
- `onSnapshot?(snapshot: Snapshot<T>)` - Called when a snapshot is created
- `onAction?(event: ActionEvent)` - Called before (`{ phase: 'before', params }`) and after (`{ phase: 'after', error? }`) action execution
- `onRollback?(snapshot: Snapshot<T>)` - Called after rollback/rollbackTo completes
- `onReset?()` - Called after reset completes
- `destroy?()` - Called on `destroy()`, in **reverse** plugin array order

**`PluginContext<T>` (received by `onInit`):**

- `data: T` - The live reactive proxy
- `state: PluginStores<T>` - All readable stores (errors, isDirty, snapshots, etc.)
- `options: Readonly<SvStateOptions>` - Resolved options
- `snapshot: SnapshotFunction` - Create snapshots programmatically

**Hook execution:** Hooks are called in plugin array order (first to last), except `destroy` which runs last-to-first. All hooks are optional.

**Internal implementation:** `createSvState` uses a `callPlugins(hook, ...args)` helper that iterates plugins and calls matching hook functions. Each call is wrapped in `try`/`catch` — a throwing plugin is reported via `onPluginError` and never aborts the mutation or blocks later plugins.

**Hydration re-baseline:** plugins that restore state in `onInit` (persist, history) write through the live proxy. Validation is deferred across the `onInit` hook, and if any change occurred the state is re-baselined afterwards: dirty fields are cleared and snapshot 0 is rewritten from the hydrated state. So restored values are the initial state, not a dirty change on top of it.

**State-restoring operations and plugins:** `rollback()`, `rollbackTo()` and `reset()` write `stateObject` directly, **bypassing the proxy**, so they fire `onRollback`/`onReset` but never `onChange`. Any plugin that mirrors state (persist, sync, history, autosave) must handle both hooks. The validation that runs at creation is delivered to `onValidation` after every plugin's `onInit`.

**Built-in plugins:** options and per-plugin behaviour notes are in `src/plugins/CLAUDE.md`.

### Deep Clone System (src/internal/clone.ts)

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

Other cloning behavior:

- `Date`, `Map`, `Set` and `RegExp` are reconstructed, not rebuilt from own keys (rebuilding produced objects that passed `instanceof` but threw on every method call)
- `Error`, `Promise`, `WeakMap`, `WeakSet`, `WeakRef`, `ArrayBuffer` and typed arrays are carried by reference
- Circular references resolve to the already-cloned instance via a `WeakMap` of visited objects
- Accessor descriptors (getters/setters) are preserved instead of being flattened into values
- Keys in `DANGEROUS_KEYS` are skipped

### Deep Proxy System (src/proxy.ts)

- `ChangeProxy<T>()` wraps objects with recursive Proxy handlers
- Tracks property paths via dot notation (e.g., `"address.zip"`)
- **Loop Prevention**: uses `Object.is` to skip unchanged values (so writing `NaN` over `NaN` is a no-op)
- **Stable identity**: child proxies are cached per (raw object, path) in a `WeakMap` of `WeakRef`s, so `data.nested === data.nested`
- **No proxies in the raw tree**: values are unwrapped (via a `RAW` symbol) before assignment, so `data.b = data.a` stores the raw object; later `data.b.x = 1` reports `b.x` once instead of firing twice with a stale `a.x`
- **`deleteProperty` trap**: `delete data.x` emits a change with `currentValue: undefined` (nothing is emitted if the key was absent)
- Excludes non-proxiable types: Date, Map, Set, WeakMap, WeakSet, RegExp, Error, Promise
- Array element writes, array `length` writes and the mutating array methods are changes of the array and report the array's own path; fields inside an element keep the index (`items.2.name`), so indexed async-validator paths (`inventory.2.quantity`) match row edits; the mutating array methods (`push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill`, `copyWithin`) run as one unit and emit a single change with the array as `currentValue` and a pre-call copy as `oldValue`; numeric-looking keys on plain objects keep their segment (`users.123.name`)

### Security Model

- **Prototype pollution** — all path-traversal and deep-clone code guards against `__proto__`, `constructor`, and `prototype` keys via the shared `DANGEROUS_KEYS` set in `src/internal/paths.ts` (used by the core, `persist`, `history` and `sync`)
- **BroadcastChannel messages** — `syncPlugin` rejects incoming payloads exceeding 10 levels of nesting (objects and arrays) (`isWithinDepthLimit` in `src/plugins/sync.ts`); accepted payloads are throttled with a trailing apply so a burst collapses to the newest state rather than dropping it
- **Plugin isolation** — a throwing plugin hook cannot abort a state mutation or block later plugins; errors surface through `onPluginError`
- **JSON serialization in sync** — state is serialized with `JSON.stringify`/`JSON.parse` (structuredClone cannot be used on Svelte reactive proxies); `Date` objects become strings and `undefined`/functions are dropped — document this for users
- **No eval/Function** — the codebase contains no dynamic code execution
- **Async race conditions** — handled via `AbortController` in `src/state.svelte.ts`

### Validation System

Validation is deferred via `queueMicrotask()` (or `setTimeout` when `debounceValidation > 0`) to batch changes. The `Validator` type is a nested object where leaf values are error strings (empty = valid); a value may also be an array (`ValidatorNode = string | Validator | ValidatorNode[]`) for per-row errors, e.g. `rows: source.items.map((item) => ({ ... }))`. `getSyncErrorForPath` (async-validation skip check) and `hasAnyErrors` walk arrays.

The `hasErrors` store uses `checkHasErrors` which recursively checks if any leaf strings are non-empty.

### Fluent Validator Builders (src/validators.ts)

`stringValidator`, `numberValidator`, `arrayValidator` and `dateValidator` are chainable; `getError()` returns the first error. The method lists are in `src/validators.ts`. Non-obvious behaviour:

- All accept `null`/`undefined`; nullish values skip most validations unless `required()` or `requiredIf()` is called
- `numberValidator`: `multipleOf`/`step` are epsilon-tolerant (`0.3` is a multiple of `0.1`); a zero divisor never matches
- `arrayValidator.unique()`: keys are type-tagged (`1` and `'1'` differ), object key order is irrelevant, dates compare by time
- `dateValidator` accepts Date, string or number

## Testing

Test files go in `test/`: `*.test.ts` for pure TypeScript (validators, proxy, internal helpers), `*.test.svelte.ts` for tests using Svelte 5 runes. Per-plugin tests are `plugins-<name>.test.svelte.ts`.

`regressions.test.svelte.ts` holds cross-cutting regression tests. When fixing a bug, add its regression test there and check it fails without the fix.

Vitest: globals enabled (no imports for `describe`, `it`, `expect`), Node environment, console output suppressed.

## Svelte 5 Runes Mode

Files with `.svelte.ts` extension use Svelte 5 runes mode, allowing `$state()`, `$derived()`, and other runes outside of `.svelte` components. The main state logic in `src/state.svelte.ts` uses this pattern.
