# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-07-31

A functional correctness pass over the whole library. Several long-standing bugs silently corrupted
state or leaked resources; fixing them changes observable behavior, hence the major version.

### Breaking

- **`delete` now fires a change** — deleting a property through the reactive proxy (`delete data.draft`) previously bypassed dirty tracking, validation, persistence and every plugin hook. It now emits a change event with `currentValue: undefined`, so validators and plugins see it. Code that relied on deletes being invisible will now see extra events.
- **Change paths keep numeric object keys** — a key like `data.users['123'].name` was reported as `users.name` because any numeric-looking key was treated as an array index. It is now reported as `users.123.name`. Only true array indices are collapsed. Async validator paths and `isDirtyByField` keys change accordingly.
- **Array `length` writes report the array path** — `data.list.length = 0` (and `pop`/`splice`) reported `list.length`; they now report `list`, matching index writes.
- **Proxy identity is stable** — `data.nested === data.nested` was `false` because a new proxy was created on every read. Child proxies are now cached, so identity comparisons and keyed `{#each}` blocks work.
- **Assigning a nested value no longer stores a proxy** — `data.b = data.a` used to write the _proxy_ of `a` into `b`, after which `data.b.x = 1` fired twice, once with the stale path `a.x`. The raw value is now unwrapped before assignment, and self-assignment is a no-op.
- **`actionError` is always an `Error`** — a thrown primitive (`throw 'boom'`) previously produced `undefined`, silently swallowing the failure. It is now wrapped, keeping the `.message` → `.body.message` → `String()` precedence.
- **`NaN` no longer passes numeric rules** — `min`, `max`, `between`, `positive`, `negative`, `nonNegative`, `notZero`, `integer`, `multipleOf`, `step`, `decimal` and `percentage` skip `NaN` like they skip `null`/`undefined`; only `required()` reports it.
- **State is re-baselined after plugin hydration** — `persistPlugin` and `historyPlugin` restore state in `onInit`, which used to mark every restored field dirty and leave the `Initial` snapshot holding pre-restore data (so `reset()` reverted past the restore). Restored state is now the baseline: `isDirty` is `false` and `reset()` returns to the restored values.

### Added

- **`validate()`** — runs sync validation immediately, bypassing the debounce, and returns `{ errors, hasErrors }`. Previously the only way to be sure errors were current before submitting was to wait for a microtask.
- **`batch(fn)`** — applies many mutations as one unit: one validation pass, each async validator scheduled at most once, and a single snapshot (undo point) for the whole batch. `effect` and plugin `onChange` still fire per mutation.
- **`onPluginError` option** — receives `(error, pluginName, hook)` when a plugin hook throws; defaults to `console.error`.
- **`PersistOptions.onError` and `AnalyticsOptions.onError`** — surface storage and sink failures instead of letting them escape.
- **New exports** — `UndoRedoOptions`, `ValidationResult`, `PluginHook`, and the `PersistPluginInstance`, `AutosavePluginInstance`, `AnalyticsPluginInstance` types.

### Fixed

- **Snapshots destroyed `Map`, `Set` and `RegExp`** — `deepClone` rebuilt them with `Object.create` plus own keys, producing objects that passed `instanceof` but threw on every method call (`clonedMap.get(k)` → `TypeError: called on incompatible receiver`). They are now reconstructed properly, and `Error`, `Promise`, `WeakMap`/`WeakSet`, `ArrayBuffer` and typed arrays are carried by reference instead of being mangled.
- **Circular state crashed the clone** — a self-referencing object caused unbounded recursion during snapshot; already-cloned objects are now reused.
- **Getters were flattened into values** by cloning; accessor descriptors are now preserved.
- **`destroy()` leaked async validations** — despite being documented as cancelling them, it only called plugin `destroy` hooks. It now cancels in-flight and debounced async validations, clears the pending validation timer, ignores later mutations, and is safe to call twice.
- **Rollback left keys added after the snapshot** — `rollback()`/`reset()` merged the snapshot over live state; keys that did not exist in the snapshot are now removed.
- **A throwing plugin aborted the mutation** and skipped every later plugin; hooks are now isolated and reported through `onPluginError`.
- **`redo()` wiped the rest of the redo stack** — applying a redo fired `onChange`, which cleared the stack, so only the first redo of a chain worked. Consecutive redos now step back correctly, each keeping its own snapshot.
- **`analyticsPlugin` always reported `hasErrors: true`** — it checked `errors !== undefined`, which is true on every pass whenever a validator exists; it now inspects the actual error leaves. `redact` also covers nested paths (`redact: ['user']` redacts `user.ssn`), and a rejected `onFlush` no longer becomes an unhandled rejection.
- **`persistPlugin` could throw out of a timer** — `JSON.stringify` and `setItem` ran unguarded, so a `QuotaExceededError` escaped asynchronously.
- **`autosavePlugin` dropped overlapping saves** — a save requested while another was in flight was discarded; it now runs once the current one settles.
- **`syncPlugin` dropped the newest inbound update** — messages arriving inside the throttle window were discarded, losing the final state. Bursts now collapse to the last payload, applied when the window closes.
- **`decimal()` miscounted exponential notation** — `1e-7` counted as 0 decimal places.
- **`multipleOf()`/`step()` failed on floats** — `0.3` was reported as not a multiple of `0.1` due to exact modulo; comparison is now epsilon-tolerant, and a zero divisor is rejected.
- **Array item comparison collided across types** — `unique()`, `includes()`, `includesAny()` and `includesAll()` keyed items with `String()`/`JSON.stringify`, so `1` matched `'1'`, `null` matched `'null'`, and `{a:1,b:2}` differed from `{b:2,a:1}`. Keys are now type-tagged with stable key ordering, and `Date` values compare by time.

### Internal

- Shared helpers moved to `src/internal/` (`clone.ts`, `paths.ts`, `errors.ts`), removing five duplicated copies of `deepClone`, `DANGEROUS_KEYS`, `getValueAtPath` and `setValueAtPath` — one of which (in `undoRedoPlugin`) was missing the prototype-pollution guard entirely.

### Demo

- Every demo page's "Fill with Valid Data" now uses `batch()` instead of sequential assignments — one validation pass per fill, and pages driven by an `effect` that calls `snapshot()` now produce a single undo point per fill instead of one per field.
- Added a "Validate Now" control to the Options demo (`validate()` bypassing `debounceValidation`) and a plugin-error simulation to the Devtools demo (`onPluginError`, showing a throwing hook doesn't abort the mutation or block other plugins).
- Wired `persistPlugin`'s and `analyticsPlugin`'s new `onError` option into the Persist/Sync and Autosave/Analytics demos.
- Deduplicated repeated markup: a shared `Spinner` component replaces seven copy-pasted loading SVGs, a shared `formatFieldName` helper replaces four inline copies, and `DemoSidebar` gained an `extra` snippet prop so pages no longer double-wrap it to append custom sidebar panels.

## [1.5.6] - 2026-07-31

### Changed

- **Updated all development dependencies** — ESLint, eslint-plugin-unicorn, Vite, and related tooling bumped to their latest versions
- **Renamed parameters for clarity** — `snapshot(title, replace)` is now `snapshot(title, shouldReplace)` and `requiredIf(cond)` is now `requiredIf(shouldRequire)`; both are positional parameters, so no code changes are required

### Fixed

- **`.integer()` validator now rejects unsafe integers** — `numberValidator().integer()` uses `Number.isSafeInteger()` instead of `Number.isInteger()`, so values outside the safe integer range are correctly flagged instead of silently passing
- **Demo build no longer warns about deprecated Vite config** — the demo's `vite.config.ts` now uses `import.meta.dirname` and a JSON import attribute instead of `__dirname` and a bare JSON import

## [1.5.5] - 2026-06-02

### Fixed

- **`actionError` swallowed non-`Error` throws** — when an action threw a plain object (e.g. an HTTP error response), `actionError` was set to `undefined` instead of wrapping the value; it now reads `.message` then `.body.message` from the thrown object and wraps the result in a proper `Error`, so callers always receive a usable error or `undefined`

## [1.5.4] - 2026-06-02

### Changed

- **TypeScript 6** — the library is now built and type-checked with TypeScript 6.0, ensuring full compatibility with projects already on TS 6
- **Updated all development dependencies** — ESLint, Svelte, Vitest, Prettier, and related tooling bumped to their latest versions

### Fixed

- **TypeScript project root misconfigured** — `tsconfig.json` was using the deprecated `rootDirs` option pointing at the repo root; corrected to `rootDir: "./src"` so the compiler only processes source files and emits a clean `dist/`

## [1.5.3] - 2026-03-31

### Fixed

- **Symbol property access on proxied state** — accessing or setting Symbol-keyed properties (e.g. those used internally by Svelte or JavaScript runtimes) on a proxied state object no longer throws or triggers change tracking incorrectly; symbols are now passed through transparently

## [1.5.2] - 2026-03-31

### Fixed

- **`syncPlugin` — incoming message depth validation** — BroadcastChannel payloads exceeding 10 levels of nesting are now rejected, preventing a malicious same-origin script from pushing deeply nested objects into state
- **`undoRedoPlugin` — redundant `onInit` override removed** — the plugin previously defined `onInit` twice (the second silently shadowed the first without calling it); consolidated into a single `onInit` that correctly sets up the snapshot subscription and `previousTipSnapshot` tracking

### Changed

- **`syncPlugin` — serialization behaviour documented** — `JSON.stringify`/`JSON.parse` is used to clone state before broadcasting (structuredClone cannot be used on Svelte reactive proxies); `Date` objects arrive as strings, `undefined` values and functions are dropped silently

## [1.5.1] - 2026-03-15

### Fixed

- **Prototype pollution** — `persistPlugin` and `syncPlugin` no longer propagate `__proto__`, `constructor`, or `prototype` keys when merging external data into state
- **Prototype pollution via path traversal** — `setValueAtPath` in `persistPlugin` and `historyPlugin` now rejects path segments matching `__proto__`, `constructor`, or `prototype`
- **Prototype pollution via snapshot restore** — `deepClone` in `createSvState` now skips dangerous keys, preventing polluted data from being re-applied through `rollback()`, `rollbackTo()`, or `reset()`
- **Unvalidated localStorage data** — `persistPlugin` now validates that parsed JSON has a numeric `version` and a plain-object `data` field before applying it; invalid payloads are silently discarded
- **Silent async validator crashes** — uncaught errors from async validators are now stored in `asyncErrors` under the relevant path instead of being re-thrown silently
- **`saveOnDestroy` with async save functions** — `autosavePlugin` now attaches `.catch(onError)` to the save promise returned during `destroy()`, preventing unhandled rejections

### Added

- **`devtoolsPlugin`** — new `logValues` option (default: `false`) to opt into logging raw state values in the console; omitting values by default prevents passwords and tokens from appearing in devtools
- **`undoRedoPlugin`** — new `maxRedoStack` option to cap the redo stack size (mirrors the main `maxSnapshots` limit)
- **`analyticsPlugin`** — new `redact` option accepting an array of property paths whose `currentValue`/`oldValue` are replaced with `'[redacted]'` in flushed events
- **`syncPlugin`** — incoming `BroadcastChannel` messages are now validated as plain objects and rate-limited to one per `throttle` ms interval, preventing message-flooding attacks

## [1.5.0] - 2026-02-26

### Added

- **Plugin system** — extend svstate with reusable behaviors via lifecycle hooks (`onInit`, `onChange`, `onValidation`, `onSnapshot`, `onAction`, `onRollback`, `onReset`, `destroy`)
- **`persistPlugin`** — automatically save and restore state to localStorage (or any custom storage) with throttled writes, schema versioning, migration support, and include/exclude field filtering
- **`autosavePlugin`** — auto-save state after a period of inactivity, on a fixed interval, or when the browser tab is hidden; exposes `saveNow()` and `isSaving()` methods
- **`devtoolsPlugin`** — log all state events (changes, snapshots, actions, rollbacks) to the browser console for easier debugging
- **`historyPlugin`** — sync selected state fields to URL search parameters, keeping the browser history in step with your app state
- **`syncPlugin`** — broadcast state changes across browser tabs in real time using BroadcastChannel
- **`undoRedoPlugin`** — adds redo capability on top of the built-in rollback, with `redo()`, `canRedo()`, and a reactive `redoStack` store
- **`analyticsPlugin`** — buffer and batch state events (changes, actions, snapshots) for sending to analytics services
- `destroy()` return value from `createSvState` — call it to clean up all plugin resources and cancel pending async validations
- New plugin type exports: `SvStatePlugin`, `PluginContext`, `PluginStores`, `ChangeEvent`, `ActionEvent`

## [1.4.1] - 2026-02-13

### Added

- Roll back to a named snapshot with `rollbackTo(title)` — returns to the last undo point matching the given title
- New `maxSnapshots` option (default: 50) to limit snapshot history size, automatically trimming the oldest entries when exceeded

## [1.4.0] - 2026-02-09

### Added

- Per-field dirty tracking via `isDirtyByField` — know exactly which fields have been modified, with automatic parent path marking (e.g., changing `address.street` also marks `address` as dirty)
- New `DirtyFields` type export for typing per-field dirty state

### Changed

- `isDirty` is now derived from `isDirtyByField`, so both stay perfectly in sync
- `reset()`, `rollback()`, and successful actions clear all per-field dirty state

## [1.3.0] - 2026-01-31

### Added

- Async validation support for server-side checks like username availability or email verification
- Configurable concurrency limit for async validators to prevent overwhelming servers
- `requiredIf(condition)` method for all validators to conditionally require fields
- New number validator with constraints for min, max, integer, positive, negative, decimal places, and more
- New array validator with constraints for length, uniqueness, and item inclusion checks
- New date validator with constraints for ranges, past/future, weekday/weekend, and age calculations

### Changed

- All validators now accept `null` or `undefined` values gracefully, skipping validation unless `required()` is called
- String validator's `prepare()` method now supports chaining multiple preprocessing operations

## [1.2.0] - 2026-01-28

### Added

- State objects can now include methods that operate on `this` - methods are preserved through snapshots, rollback, and reset operations

## [1.1.0] - 2026-01-20

### Changed

- Library now ships as ESM (ES Modules) only - CommonJS is no longer supported
- Improved compatibility with modern bundlers and Svelte 5 projects using native ES modules

## [1.0.1] - 2026-01-17

### Changed

- Improved proxy performance by replacing Reflect API with direct property access
- Switched from locale-dependent case conversion to standard case conversion for consistent behavior across environments

## [1.0.0] - 2026-01-18

### Initial release
