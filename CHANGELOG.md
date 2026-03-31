# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
