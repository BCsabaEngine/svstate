# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**svstate** is a Svelte 5 library that provides a supercharged `$state()` with deep reactive proxies, validation, cross-field rules, computed fields, and side effects. It's designed as a peer dependency for Svelte 5 projects.

## Development Commands

### Testing

```bash
npm test                 # Run all tests once
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
```

Coverage thresholds are set at 60% for lines, functions, branches, and statements (vitest.config.ts:14-18).

### Building

```bash
npm run build           # Clean build (includes tsc --build --clean && --force)
npm run clean           # Clean TypeScript build artifacts
```

The build outputs to `dist/` directory with CommonJS modules. TypeScript compilation is strict with comprehensive checks enabled (tsconfig.json).

### Code Quality

```bash
npm run lint:check      # Check for linting errors
npm run lint:fix        # Auto-fix linting errors
npm run format:check    # Check code formatting
npm run format:fix      # Auto-fix formatting issues
npm run fix             # Run format → lint → format (recommended)
npm run all             # Run fix → build → test (full validation)
```

### Demo

```bash
npm run demo            # Start Vite dev server with demo app
```

Note: The demo directory doesn't exist yet in the repository.

## Architecture

### Core State Management (src/stateManager.ts)

The library exports a single main function `createValidatedState<S>()` that creates a deeply reactive proxy around a state object. Key architectural components:

#### Deep Proxy System

- Uses recursive `Proxy` objects to intercept property access and mutations at any depth
- Implements path tracking via dot notation (e.g., `"address.zip"`)
- **Loop Prevention**: Uses `Object.is()` comparison to skip setting if value hasn't changed (line 47)
- Returns nested proxies for object properties to maintain deep reactivity (line 73)

#### Validation Architecture

Three validation layers work together:

1. **Property Validators** (`validators` option): Per-field validation functions that return error strings or undefined
2. **Cross-Field Validators** (`crossFieldValidators` option): Function that receives full state and validates relationships between fields
3. **Async Validation Execution**: Uses `tick()` to defer validation until after Svelte's reactive updates (line 58)

The `$errors` store contains validation results as `Record<string, string[] | undefined>` where keys can be field paths or custom cross-field keys.

#### Computed Fields System

- Defined via `computed` option with explicit dependency tracking
- Each computed field has `{ fn, deps }` where `deps` is `Record<string, true>` of field names
- Returns Svelte `derived` stores that auto-update when dependencies change (line 69)
- Accessed like regular properties but return reactive stores

#### Side Effects System

- Array of functions that run on any property change
- Receive `(state, changedPath)` parameters
- Execute synchronously before validation (line 52)
- Can trigger cascading updates but loop protection prevents infinite cycles

#### Reactive Stores

- `$errors`: Readable store of current validation state
- `$changed`: Readable store tracking the most recent changed property path
- Both are accessible as special properties on the proxy (lines 63-64)

### Type System

The library uses TypeScript generics to preserve type safety:

- State type `S extends Record<string, any>` is preserved through the proxy
- Return type augments `S` with `$errors` and `$changed` stores
- Validators are typed as `Validator<T>` for type-safe value checks

### Integration with Svelte 5

- Uses Svelte's `tick()` for coordinating with reactive system
- Integrates with Svelte stores (`readable`, `derived`) for reactive tracking
- Designed to work alongside Svelte 5 runes (`$state`, `$derived`, etc.)
- The state object can be bound directly to Svelte inputs via `bind:value`

## Code Style

### ESLint Configuration

- Uses `@typescript-eslint` for TypeScript linting
- **Import sorting**: Enforced via `eslint-plugin-simple-import-sort` (must be sorted alphabetically)
- **Unicorn plugin**: Enabled with most rules, some exceptions:
  - `unicorn/filename-case`: off (allows camelCase files)
  - `unicorn/no-array-reduce`: off (reduce is allowed)
  - `unicorn/no-nested-ternary`: off
- **Curly braces**: `"multi"` style (multi-line only)
- **Prohibited**: `no-alert`, `no-debugger` are errors

### TypeScript Configuration

- **Target**: ES2020, CommonJS modules
- **Strict mode**: Fully enabled with additional checks:
  - `noUnusedLocals`, `noUnusedParameters`
  - `noImplicitReturns`, `noImplicitOverride`
  - `noPropertyAccessFromIndexSignature`, `noUncheckedIndexedAccess`
- Source is in `src/`, output to `dist/`
- Test and examples directories are excluded from compilation

### Formatting

- Uses Prettier with default configuration
- Format check filters out unchanged files in output

## Testing Strategy

Tests should be placed in `test/**/*.test.ts` (though test directory doesn't exist yet). The vitest configuration:

- Globals enabled (no need to import `describe`, `it`, `expect`)
- Node environment
- Console output suppressed during tests
- Coverage reports in text, HTML, and LCOV formats
