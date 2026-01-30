import { derived, get, type Readable, writable } from 'svelte/store';

import { ChangeProxy } from './proxy';

// Types
export type Validator = { [S in string]: string | Validator };

type Action<P extends object> = (parameters?: P) => Promise<void> | void;

export type Snapshot<T> = {
  title: string;
  data: T;
};

export type SnapshotFunction = (title: string, replace?: boolean) => void;

export type EffectContext<T> = {
  snapshot: SnapshotFunction;
  target: T;
  property: string;
  currentValue: unknown;
  oldValue: unknown;
};

// Async validation types
export type AsyncValidatorFunction<T> = (value: unknown, source: T, signal: AbortSignal) => Promise<string>;

export type AsyncValidator<T> = {
  [propertyPath: string]: AsyncValidatorFunction<T>;
};

export type AsyncErrors = {
  [propertyPath: string]: string;
};

type Actuators<T extends Record<string, unknown>, V extends Validator, P extends object> = {
  validator?: (source: T) => V;
  effect?: (context: EffectContext<T>) => void;
  action?: Action<P>;
  actionCompleted?: (error?: unknown) => void | Promise<void>;
  asyncValidator?: AsyncValidator<T>;
};

type StateResult<T, V> = {
  errors: Readable<V | undefined>;
  hasErrors: Readable<boolean>;
  isDirty: Readable<boolean>;
  actionInProgress: Readable<boolean>;
  actionError: Readable<Error | undefined>;
  snapshots: Readable<Snapshot<T>[]>;
  asyncErrors: Readable<AsyncErrors>;
  hasAsyncErrors: Readable<boolean>;
  asyncValidating: Readable<string[]>;
  hasCombinedErrors: Readable<boolean>;
};

// Helpers
const checkHasErrors = (validator: Validator): boolean =>
  Object.values(validator).some((item) => (typeof item === 'string' ? !!item : checkHasErrors(item)));
const hasAnyErrors = ($errors: Validator | undefined): boolean => !!$errors && checkHasErrors($errors);

const deepClone = <T>(object: T): T => {
  if (object === null || typeof object !== 'object') return object;
  if (object instanceof Date) return new Date(object) as T;
  if (Array.isArray(object)) return object.map((item) => deepClone(item)) as T;
  const cloned = Object.create(Object.getPrototypeOf(object)) as T;
  for (const key of Object.keys(object)) cloned[key as keyof T] = deepClone(object[key as keyof T]);
  return cloned;
};

// Async validation helpers
const getValueAtPath = <T>(source: T, path: string): unknown => {
  const parts = path.split('.');
  let current: unknown = source;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

const getSyncErrorForPath = (errors: Validator | undefined, path: string): string => {
  if (!errors) return '';
  const parts = path.split('.');
  let current: string | Validator = errors;
  for (const part of parts) {
    if (typeof current === 'string') return '';
    if (current[part] === undefined) return '';
    current = current[part];
  }
  return typeof current === 'string' ? current : '';
};

const getMatchingAsyncValidatorPaths = <T>(asyncValidator: AsyncValidator<T>, changedPath: string): string[] => {
  const matches: string[] = [];
  for (const registeredPath of Object.keys(asyncValidator))
    // Exact match or changed path is a prefix of registered path
    if (registeredPath === changedPath || registeredPath.startsWith(changedPath + '.')) matches.push(registeredPath);
    // Changed path is nested within registered path (e.g., validator for 'user', changed 'user.name')
    else if (changedPath.startsWith(registeredPath + '.')) matches.push(registeredPath);

  return matches;
};

// Options
export type SvStateOptions = {
  resetDirtyOnAction: boolean;
  debounceValidation: number;
  allowConcurrentActions: boolean;
  persistActionError: boolean;
  debounceAsyncValidation: number;
  runAsyncValidationOnInit: boolean;
  clearAsyncErrorsOnChange: boolean;
};
const defaultOptions: SvStateOptions = {
  resetDirtyOnAction: true,
  debounceValidation: 0,
  allowConcurrentActions: false,
  persistActionError: false,
  debounceAsyncValidation: 300,
  runAsyncValidationOnInit: false,
  clearAsyncErrorsOnChange: true
};

// createSvState
export function createSvState<T extends Record<string, unknown>, V extends Validator, P extends object>(
  init: T,
  actuators?: Actuators<T, V, P>,
  options?: Partial<SvStateOptions>
) {
  const usedOptions: SvStateOptions = { ...defaultOptions, ...options };

  const { validator, effect, asyncValidator } = actuators ?? {};

  const errors = writable<V | undefined>();
  const hasErrors = derived(errors, hasAnyErrors);
  const isDirty = writable(false);
  const actionInProgress = writable(false);
  const actionError = writable<Error | undefined>();
  const snapshots = writable<Snapshot<T>[]>([{ title: 'Initial', data: deepClone(init) }]);

  // Async validation stores
  const asyncErrorsStore = writable<AsyncErrors>({});
  const asyncValidatingSet = writable<Set<string>>(new Set());
  const asyncValidating = derived(asyncValidatingSet, ($set) => [...$set]);
  const hasAsyncErrors = derived(asyncErrorsStore, ($asyncErrors) =>
    Object.values($asyncErrors).some((error) => !!error)
  );
  const hasCombinedErrors = derived(
    [hasErrors, hasAsyncErrors],
    ([$hasErrors, $hasAsyncErrors]) => $hasErrors || $hasAsyncErrors
  );

  // Async validation trackers for cancellation
  const asyncValidationTrackers = new Map<
    string,
    { controller: AbortController; timeoutId: ReturnType<typeof setTimeout> }
  >();

  const stateObject = $state<T>(init);

  const createSnapshot: SnapshotFunction = (title: string, replace = true) => {
    const currentSnapshots = get(snapshots);
    const createdSnapshot: Snapshot<T> = { title, data: deepClone(stateObject) };
    const lastSnapshot = currentSnapshots.at(-1);

    if (replace && lastSnapshot && lastSnapshot.title === title)
      snapshots.set([...currentSnapshots.slice(0, -1), createdSnapshot]);
    else snapshots.set([...currentSnapshots, createdSnapshot]);
  };

  let validationScheduled = false;
  let validationTimeout: ReturnType<typeof setTimeout> | undefined;

  const scheduleValidation = () => {
    if (!validator) return;

    if (usedOptions.debounceValidation > 0) {
      clearTimeout(validationTimeout);
      validationTimeout = setTimeout(() => {
        errors.set(validator(data));
      }, usedOptions.debounceValidation);
    } else {
      if (validationScheduled) return;
      validationScheduled = true;
      queueMicrotask(() => {
        errors.set(validator(data));
        validationScheduled = false;
      });
    }
  };

  // Async validation functions
  const cancelAsyncValidation = (path: string) => {
    const tracker = asyncValidationTrackers.get(path);
    if (tracker) {
      clearTimeout(tracker.timeoutId);
      tracker.controller.abort();
      asyncValidationTrackers.delete(path);
      asyncValidatingSet.update(($set) => {
        $set.delete(path);
        return new Set($set);
      });
    }
  };

  const cancelAllAsyncValidations = () => {
    for (const path of asyncValidationTrackers.keys()) cancelAsyncValidation(path);
    asyncErrorsStore.set({});
  };

  const scheduleAsyncValidation = (path: string) => {
    if (!asyncValidator || !asyncValidator[path]) return;

    // Cancel any existing validation for this path
    cancelAsyncValidation(path);

    // Clear async error if configured
    if (usedOptions.clearAsyncErrorsOnChange)
      asyncErrorsStore.update(($asyncErrors) => {
        const updated = { ...$asyncErrors };
        delete updated[path];
        return updated;
      });

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      // Check sync error for this path - skip if sync fails
      const syncError = getSyncErrorForPath(get(errors), path);
      if (syncError) {
        asyncValidationTrackers.delete(path);
        return;
      }

      // Mark as validating
      asyncValidatingSet.update(($set) => new Set([...$set, path]));

      try {
        const value = getValueAtPath(data, path);
        const asyncValidatorForPath = asyncValidator[path];
        if (!asyncValidatorForPath) return;

        const error = await asyncValidatorForPath(value, data, controller.signal);

        // Only update if not aborted
        if (!controller.signal.aborted)
          asyncErrorsStore.update(($asyncErrors) => ({
            ...$asyncErrors,
            [path]: error
          }));
      } catch (error) {
        // Ignore abort errors, re-throw others
        if (error instanceof Error && error.name !== 'AbortError') throw error;
      } finally {
        asyncValidationTrackers.delete(path);
        asyncValidatingSet.update(($set) => {
          $set.delete(path);
          return new Set($set);
        });
      }
    }, usedOptions.debounceAsyncValidation);

    asyncValidationTrackers.set(path, { controller, timeoutId });
  };

  const scheduleAsyncValidationsForPath = (changedPath: string) => {
    if (!asyncValidator) return;

    const matchingPaths = getMatchingAsyncValidatorPaths(asyncValidator, changedPath);
    for (const path of matchingPaths) scheduleAsyncValidation(path);
  };

  const data = ChangeProxy(stateObject, (target: T, property: string, currentValue: unknown, oldValue: unknown) => {
    if (!usedOptions.persistActionError) actionError.set(undefined);
    isDirty.set(true);
    const effectResult: unknown = effect?.({ snapshot: createSnapshot, target, property, currentValue, oldValue });
    if (effectResult instanceof Promise)
      throw new Error('svstate: effect callback must be synchronous. Use action for async operations.');
    scheduleValidation();
    scheduleAsyncValidationsForPath(property);
  });

  if (validator) errors.set(validator(data));

  // Run async validation on init if configured
  if (asyncValidator && usedOptions.runAsyncValidationOnInit)
    for (const path of Object.keys(asyncValidator)) scheduleAsyncValidation(path);

  const execute = async (parameters?: P) => {
    if (!usedOptions.allowConcurrentActions && get(actionInProgress)) return;

    actionError.set(undefined);
    actionInProgress.set(true);
    try {
      await actuators?.action?.(parameters);
      if (usedOptions.resetDirtyOnAction) isDirty.set(false);
      snapshots.set([{ title: 'Initial', data: deepClone(stateObject) }]);
      await actuators?.actionCompleted?.();
    } catch (caughtError) {
      await actuators?.actionCompleted?.(caughtError);
      actionError.set(caughtError instanceof Error ? caughtError : undefined);
    } finally {
      actionInProgress.set(false);
    }
  };

  const rollback = (steps = 1) => {
    const currentSnapshots = get(snapshots);
    if (currentSnapshots.length <= 1) return;

    const targetIndex = Math.max(0, currentSnapshots.length - 1 - steps);
    const targetSnapshot = currentSnapshots[targetIndex];
    if (!targetSnapshot) return;

    cancelAllAsyncValidations();
    Object.assign(stateObject, deepClone(targetSnapshot.data));
    snapshots.set(currentSnapshots.slice(0, targetIndex + 1));

    if (validator) errors.set(validator(data));
  };

  const reset = () => {
    const currentSnapshots = get(snapshots);
    const initialSnapshot = currentSnapshots[0];
    if (!initialSnapshot) return;

    cancelAllAsyncValidations();
    Object.assign(stateObject, deepClone(initialSnapshot.data));
    snapshots.set([initialSnapshot]);

    if (validator) errors.set(validator(data));
  };

  const state: StateResult<T, V> = {
    errors,
    hasErrors,
    isDirty,
    actionInProgress,
    actionError,
    snapshots,
    asyncErrors: asyncErrorsStore,
    hasAsyncErrors,
    asyncValidating,
    hasCombinedErrors
  };

  return { data, execute, state, rollback, reset };
}
