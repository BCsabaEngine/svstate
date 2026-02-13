# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
