import { derived, get, type Readable, writable } from 'svelte/store';

import type { SvStatePlugin } from './plugin';
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

export type DirtyFields = {
  [propertyPath: string]: boolean;
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
  isDirtyByField: Readable<DirtyFields>;
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
  maxConcurrentAsyncValidations: number;
  maxSnapshots: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: SvStatePlugin<any>[];
};
const defaultOptions: SvStateOptions = {
  resetDirtyOnAction: true,
  debounceValidation: 0,
  allowConcurrentActions: false,
  persistActionError: false,
  debounceAsyncValidation: 300,
  runAsyncValidationOnInit: false,
  clearAsyncErrorsOnChange: true,
  maxConcurrentAsyncValidations: 4,
  maxSnapshots: 50,
  plugins: []
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
  const dirtyFieldsStore = writable<DirtyFields>({});
  const isDirty = derived(dirtyFieldsStore, ($fields) => Object.keys($fields).length > 0);
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

  // Queue for async validations waiting to run (when at concurrency limit)
  const asyncValidationQueue: string[] = [];

  const markDirtyWithParents = (property: string) => {
    dirtyFieldsStore.update(($fields) => {
      const updated = { ...$fields, [property]: true };
      const parts = property.split('.');
      for (let index = 1; index < parts.length; index++) updated[parts.slice(0, index).join('.')] = true;
      return updated;
    });
  };

  const stateObject = $state<T>(init);

  // Plugin system
  const plugins = usedOptions.plugins as SvStatePlugin<T>[];
  const callPlugins = (hook: string, ...arguments_: unknown[]) => {
    for (const plugin of plugins) {
      const function_ = plugin[hook as keyof SvStatePlugin<T>];
      if (typeof function_ === 'function') (function_ as (...a: unknown[]) => void).call(plugin, ...arguments_);
    }
  };

  const runValidation = () => {
    if (!validator) return;
    const result = validator(data);
    errors.set(result);
    callPlugins('onValidation', result);
  };

  const createSnapshot: SnapshotFunction = (title: string, replace = true) => {
    const currentSnapshots = get(snapshots);
    const createdSnapshot: Snapshot<T> = { title, data: deepClone(stateObject) };
    const lastSnapshot = currentSnapshots.at(-1);

    let updatedSnapshots: Snapshot<T>[] =
      replace && lastSnapshot && lastSnapshot.title === title
        ? [...currentSnapshots.slice(0, -1), createdSnapshot]
        : [...currentSnapshots, createdSnapshot];

    if (usedOptions.maxSnapshots > 0 && updatedSnapshots.length > usedOptions.maxSnapshots) {
      const excess = updatedSnapshots.length - usedOptions.maxSnapshots;
      updatedSnapshots = [updatedSnapshots[0]!, ...updatedSnapshots.slice(1 + excess)];
    }

    snapshots.set(updatedSnapshots);
    callPlugins('onSnapshot', createdSnapshot);
  };

  let validationScheduled = false;
  let validationTimeout: ReturnType<typeof setTimeout> | undefined;

  const scheduleValidation = () => {
    if (!validator) return;

    if (usedOptions.debounceValidation > 0) {
      clearTimeout(validationTimeout);
      validationTimeout = setTimeout(() => {
        runValidation();
      }, usedOptions.debounceValidation);
    } else {
      if (validationScheduled) return;
      validationScheduled = true;
      queueMicrotask(() => {
        runValidation();
        validationScheduled = false;
      });
    }
  };

  // Async validation functions
  const removeFromQueue = (path: string) => {
    const index = asyncValidationQueue.indexOf(path);
    if (index !== -1) asyncValidationQueue.splice(index, 1);
  };

  const cancelAsyncValidation = (path: string) => {
    // Remove from queue if waiting
    removeFromQueue(path);

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
    asyncValidationQueue.length = 0;
    for (const path of asyncValidationTrackers.keys()) cancelAsyncValidation(path);
    asyncErrorsStore.set({});
  };

  const executeAsyncValidation = async (path: string, onComplete: () => void) => {
    if (!asyncValidator) {
      onComplete();
      return;
    }

    const asyncValidatorForPath = asyncValidator[path];
    if (!asyncValidatorForPath) {
      onComplete();
      return;
    }

    // Check sync error for this path - skip if sync fails
    const syncError = getSyncErrorForPath(get(errors), path);
    if (syncError) {
      onComplete();
      return;
    }

    const controller = new AbortController();
    // Store controller with a dummy timeoutId (validation already started)
    asyncValidationTrackers.set(path, { controller, timeoutId: 0 as unknown as ReturnType<typeof setTimeout> });

    // Mark as validating
    asyncValidatingSet.update(($set) => new Set([...$set, path]));

    try {
      const value = getValueAtPath(data, path);
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
      onComplete();
    }
  };

  const processAsyncValidationQueue = () => {
    while (asyncValidationQueue.length > 0) {
      const currentActiveCount = get(asyncValidatingSet).size;
      if (currentActiveCount >= usedOptions.maxConcurrentAsyncValidations) break;

      const path = asyncValidationQueue.shift();
      if (path) executeAsyncValidation(path, processAsyncValidationQueue);
    }
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
    const timeoutId = setTimeout(() => {
      // Remove tracker since debounce is done
      asyncValidationTrackers.delete(path);

      // Check if we can run immediately or need to queue
      const activeCount = get(asyncValidatingSet).size;
      if (activeCount < usedOptions.maxConcurrentAsyncValidations)
        executeAsyncValidation(path, processAsyncValidationQueue);
      else {
        // Remove any existing entry for this path and add to end of queue
        removeFromQueue(path);
        asyncValidationQueue.push(path);
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
    markDirtyWithParents(property);
    const effectResult: unknown = effect?.({ snapshot: createSnapshot, target, property, currentValue, oldValue });
    if (effectResult instanceof Promise)
      throw new Error('svstate: effect callback must be synchronous. Use action for async operations.');
    callPlugins('onChange', { target, property, currentValue, oldValue });
    scheduleValidation();
    scheduleAsyncValidationsForPath(property);
  });

  runValidation();

  // Run async validation on init if configured
  if (asyncValidator && usedOptions.runAsyncValidationOnInit)
    for (const path of Object.keys(asyncValidator)) scheduleAsyncValidation(path);

  const execute = async (parameters?: P) => {
    if (!usedOptions.allowConcurrentActions && get(actionInProgress)) return;

    callPlugins('onAction', { phase: 'before', params: parameters });
    actionError.set(undefined);
    actionInProgress.set(true);
    try {
      await actuators?.action?.(parameters);
      if (usedOptions.resetDirtyOnAction) dirtyFieldsStore.set({});
      snapshots.set([{ title: 'Initial', data: deepClone(stateObject) }]);
      await actuators?.actionCompleted?.();
      callPlugins('onAction', { phase: 'after', params: parameters });
    } catch (caughtError) {
      await actuators?.actionCompleted?.(caughtError);
      const actionError_ = caughtError instanceof Error ? caughtError : undefined;
      actionError.set(actionError_);
      callPlugins('onAction', { phase: 'after', params: parameters, error: actionError_ });
    } finally {
      actionInProgress.set(false);
    }
  };

  const restoreToSnapshot = (targetIndex: number, currentSnapshots: Snapshot<T>[]) => {
    const targetSnapshot = currentSnapshots[targetIndex];
    if (!targetSnapshot) return;
    cancelAllAsyncValidations();
    dirtyFieldsStore.set({});
    Object.assign(stateObject, deepClone(targetSnapshot.data));
    snapshots.set(currentSnapshots.slice(0, targetIndex + 1));
    runValidation();
    return targetSnapshot;
  };

  const rollback = (steps = 1) => {
    const currentSnapshots = get(snapshots);
    if (currentSnapshots.length <= 1) return;
    const targetIndex = Math.max(0, currentSnapshots.length - 1 - steps);
    const targetSnapshot = restoreToSnapshot(targetIndex, currentSnapshots);
    if (targetSnapshot) callPlugins('onRollback', targetSnapshot);
  };

  const rollbackTo = (title: string): boolean => {
    const currentSnapshots = get(snapshots);
    if (currentSnapshots.length <= 1) return false;
    for (let index = currentSnapshots.length - 1; index >= 0; index--)
      if (currentSnapshots[index]!.title === title) {
        const targetSnapshot = restoreToSnapshot(index, currentSnapshots);
        if (targetSnapshot) callPlugins('onRollback', targetSnapshot);
        return true;
      }

    return false;
  };

  const reset = () => {
    const currentSnapshots = get(snapshots);
    if (!currentSnapshots[0]) return;
    restoreToSnapshot(0, currentSnapshots);
    callPlugins('onReset');
  };

  const state: StateResult<T, V> = {
    errors,
    hasErrors,
    isDirty,
    isDirtyByField: dirtyFieldsStore,
    actionInProgress,
    actionError,
    snapshots,
    asyncErrors: asyncErrorsStore,
    hasAsyncErrors,
    asyncValidating,
    hasCombinedErrors
  };

  const destroy = () => {
    for (let index = plugins.length - 1; index >= 0; index--) plugins[index]?.destroy?.();
  };

  callPlugins('onInit', { data, state, options: usedOptions, snapshot: createSnapshot });

  return { data, execute, state, rollback, rollbackTo, reset, destroy };
}
