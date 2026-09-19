import { derived, get, type Readable, writable } from 'svelte/store';

import { deepClone } from './internal/clone';
import { getChangedPaths } from './internal/diff';
import { hasAnyErrors, toError } from './internal/errors';
import { getMatchingPaths, getValueAtPath } from './internal/paths';
import type { SvStatePlugin } from './plugin';
import { ChangeProxy } from './proxy';

// Types
// Per-row errors are arrays: `inventory: source.inventory.map((item) => ({ quantity: ... }))`
export type ValidatorNode = string | Validator | ValidatorNode[];
export type Validator = { [S in string]: ValidatorNode };

type Action<P extends object> = (parameters?: P) => Promise<void> | void;

export type Snapshot<T> = {
  title: string;
  data: T;
};

export type SnapshotFunction = (title: string, shouldReplace?: boolean) => void;

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

export type ValidationResult<V> = {
  errors: V | undefined;
  hasErrors: boolean;
};

// Effects keyed by property path; each runs only when a matching path changes
export type PathEffect<T> = {
  [propertyPath: string]: (context: EffectContext<T>) => void;
};

type Actuators<T extends Record<string, unknown>, V extends Validator, P extends object> = {
  validator?: (source: T) => V;
  effect?: (context: EffectContext<T>) => void;
  pathEffect?: PathEffect<T>;
  action?: Action<P>;
  actionCompleted?: (error?: unknown) => void | Promise<void>;
  asyncValidator?: AsyncValidator<T>;
};

export type StateResult<T, V> = {
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

// Async validation helpers
// Walks only through objects and arrays on purpose: a string ancestor means the error sits above
// this path, not on it, and indexing into that string would yield a bogus single-character "error"
const getSyncErrorForPath = (errors: Validator | undefined, path: string): string => {
  let current: unknown = errors;
  for (const part of path.split('.')) {
    if (typeof current !== 'object' || current === null) return '';
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : '';
};

const INITIAL_SNAPSHOT_TITLE = 'Initial';

// Options
export type PluginHook = Exclude<keyof SvStatePlugin<Record<string, unknown>>, 'name'>;

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
  onPluginError: (error: unknown, pluginName: string, hook: PluginHook) => void;
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
  onPluginError: (error, pluginName, hook) => console.error(`svstate: plugin "${pluginName}" threw in ${hook}`, error),
  plugins: []
};

// createSvState
export function createSvState<T extends Record<string, unknown>, V extends Validator, P extends object>(
  init: T,
  actuators?: Actuators<T, V, P>,
  options?: Partial<SvStateOptions>
) {
  const usedOptions: SvStateOptions = { ...defaultOptions, ...options };

  const { validator, effect, pathEffect, asyncValidator } = actuators ?? {};

  const errors = writable<V | undefined>();
  const hasErrors = derived(errors, hasAnyErrors);
  const dirtyFieldsStore = writable<DirtyFields>({});
  const isDirty = derived(dirtyFieldsStore, ($fields) => Object.keys($fields).length > 0);
  const actionInProgress = writable(false);
  const actionError = writable<Error | undefined>();
  const snapshots = writable<Snapshot<T>[]>([{ title: INITIAL_SNAPSHOT_TITLE, data: deepClone(init) }]);

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

  // Async validation trackers for cancellation. A path is either waiting out its debounce
  // delay or already running — never both, so each phase carries only what it can cancel.
  type AsyncTracker =
    { kind: 'debounced'; timeoutId: ReturnType<typeof setTimeout> } | { kind: 'running'; controller: AbortController };
  const asyncValidationTrackers = new Map<string, AsyncTracker>();

  // Queue for async validations waiting to run (when at concurrency limit)
  const asyncValidationQueue: string[] = [];

  let isDestroyed = false;

  const markDirtyWithParents = (property: string) => {
    dirtyFieldsStore.update(($fields) => {
      const updated = { ...$fields, [property]: true };
      const parts = property.split('.');
      for (let index = 1; index < parts.length; index++) updated[parts.slice(0, index).join('.')] = true;
      return updated;
    });
  };

  const stateObject = $state<T>(init);

  // Deferral state for batch() and for plugin hydration during onInit
  let isBatching = false;
  // Nothing can mutate before the onInit hook runs, so this stays false until hydration
  let hasChanged = false;
  let batchedSnapshotTitle: string | undefined;
  let isBatchedSnapshotReplace = true;
  const batchedAsyncPaths = new Set<string>();

  // Plugin system
  const plugins = usedOptions.plugins as SvStatePlugin<T>[];

  // A throwing plugin must not abort the mutation that triggered it, nor block later plugins.
  const callPlugin = <H extends PluginHook>(plugin: SvStatePlugin<T>, hook: H, arguments_: unknown[]) => {
    const function_ = plugin[hook];
    if (typeof function_ !== 'function') return;
    try {
      (function_ as (...a: unknown[]) => void).apply(plugin, arguments_);
    } catch (error) {
      usedOptions.onPluginError(error, plugin.name, hook);
    }
  };

  const callPlugins = <H extends PluginHook>(hook: H, ...arguments_: Parameters<NonNullable<SvStatePlugin<T>[H]>>) => {
    for (const plugin of plugins) callPlugin(plugin, hook, arguments_);
  };

  const runValidation = (shouldNotify = true) => {
    if (!validator) return;
    const result = validator(data);
    errors.set(result);
    if (shouldNotify) callPlugins('onValidation', result);
  };

  const createSnapshot: SnapshotFunction = (title: string, shouldReplace = true) => {
    // Inside a batch every mutation still runs `effect`, but the batch yields one undo point
    if (isBatching) {
      if (batchedSnapshotTitle === undefined) {
        batchedSnapshotTitle = title;
        isBatchedSnapshotReplace = shouldReplace;
      }
      return;
    }

    const currentSnapshots = get(snapshots);
    const createdSnapshot: Snapshot<T> = { title, data: deepClone(stateObject) };
    const lastSnapshot = currentSnapshots.at(-1);

    // The Initial snapshot (index 0) is the reset target and is never replaced
    let updatedSnapshots: Snapshot<T>[] =
      shouldReplace && lastSnapshot && currentSnapshots.length > 1 && lastSnapshot.title === title
        ? [...currentSnapshots.slice(0, -1), createdSnapshot]
        : [...currentSnapshots, createdSnapshot];

    if (usedOptions.maxSnapshots > 0 && updatedSnapshots.length > usedOptions.maxSnapshots) {
      const excess = updatedSnapshots.length - usedOptions.maxSnapshots;
      updatedSnapshots = [updatedSnapshots[0]!, ...updatedSnapshots.slice(1 + excess)];
    }

    snapshots.set(updatedSnapshots);
    callPlugins('onSnapshot', createdSnapshot);
  };

  let isValidationScheduled = false;
  let validationTimeout: ReturnType<typeof setTimeout> | undefined;

  const clearValidationTimer = () => {
    if (validationTimeout === undefined) return;
    clearTimeout(validationTimeout);
    validationTimeout = undefined;
  };

  const scheduleValidation = () => {
    if (!validator || isDestroyed) return;

    if (usedOptions.debounceValidation > 0) {
      clearTimeout(validationTimeout);
      validationTimeout = setTimeout(() => {
        validationTimeout = undefined;
        runValidation();
      }, usedOptions.debounceValidation);
    } else {
      if (isValidationScheduled) return;
      isValidationScheduled = true;
      queueMicrotask(() => {
        isValidationScheduled = false;
        if (!isDestroyed) runValidation();
      });
    }
  };

  // Async validation functions
  const removeFromQueue = (path: string) => {
    const index = asyncValidationQueue.indexOf(path);
    if (index !== -1) asyncValidationQueue.splice(index, 1);
  };

  const markValidating = (path: string) => asyncValidatingSet.update(($set) => new Set([...$set, path]));

  const unmarkValidating = (path: string) =>
    asyncValidatingSet.update(($set) => {
      $set.delete(path);
      return new Set($set);
    });

  const cancelAsyncValidation = (path: string) => {
    // Remove from queue if waiting
    removeFromQueue(path);

    const tracker = asyncValidationTrackers.get(path);
    if (tracker) {
      if (tracker.kind === 'debounced') clearTimeout(tracker.timeoutId);
      else tracker.controller.abort();
      asyncValidationTrackers.delete(path);
      unmarkValidating(path);
    }
  };

  const cancelAllAsyncValidations = () => {
    asyncValidationQueue.length = 0;
    for (const path of asyncValidationTrackers.keys()) cancelAsyncValidation(path);
    asyncErrorsStore.set({});
  };

  const executeAsyncValidation = async (path: string, onComplete: () => void) => {
    const asyncValidatorForPath = asyncValidator?.[path];
    // Nothing to run, torn down, or sync validation already failed for this path
    if (!asyncValidatorForPath || isDestroyed || getSyncErrorForPath(get(errors), path)) {
      onComplete();
      return;
    }

    const controller = new AbortController();
    asyncValidationTrackers.set(path, { kind: 'running', controller });

    markValidating(path);

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
      if (error instanceof Error && error.name === 'AbortError') return;
      // Store unexpected validator errors rather than re-throwing
      if (!controller.signal.aborted)
        asyncErrorsStore.update(($asyncErrors) => ({ ...$asyncErrors, [path]: toError(error).message }));
    } finally {
      // A change mid-flight cancels this run and may already have scheduled a newer one for the
      // same path; only clean up the tracker (and the validating flag) if it is still ours
      const tracker = asyncValidationTrackers.get(path);
      if (!tracker || (tracker.kind === 'running' && tracker.controller === controller)) {
        asyncValidationTrackers.delete(path);
        unmarkValidating(path);
      }
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
    if (isDestroyed || !asyncValidator || !Object.hasOwn(asyncValidator, path)) return;

    // Cancel any existing validation for this path
    cancelAsyncValidation(path);

    // Clear async error if configured
    if (usedOptions.clearAsyncErrorsOnChange)
      asyncErrorsStore.update(($asyncErrors) => {
        const updated = { ...$asyncErrors };
        delete updated[path];
        return updated;
      });

    const timeoutId = setTimeout(() => {
      // Remove tracker since debounce is done
      asyncValidationTrackers.delete(path);

      // Check if we can run immediately or need to queue
      const activeCount = get(asyncValidatingSet).size;
      if (activeCount < usedOptions.maxConcurrentAsyncValidations)
        executeAsyncValidation(path, processAsyncValidationQueue);
      else asyncValidationQueue.push(path);
    }, usedOptions.debounceAsyncValidation);

    asyncValidationTrackers.set(path, { kind: 'debounced', timeoutId });
  };

  const flushDeferredValidation = () => {
    const pendingPaths = [...batchedAsyncPaths];
    batchedAsyncPaths.clear();
    scheduleValidation();
    for (const path of pendingPaths) scheduleAsyncValidation(path);
  };

  const scheduleAsyncValidationsForPath = (changedPath: string) => {
    if (!asyncValidator) return;

    const matchingPaths = getMatchingPaths(Object.keys(asyncValidator), changedPath);
    if (isBatching) {
      for (const path of matchingPaths) batchedAsyncPaths.add(path);
      return;
    }
    for (const path of matchingPaths) scheduleAsyncValidation(path);
  };

  const runEffect = (function_: ((context: EffectContext<T>) => void) | undefined, context: EffectContext<T>) => {
    const result: unknown = function_?.(context);
    if (result instanceof Promise) {
      // The rejection can't be handled by anyone, so don't let it surface as an unhandled one
      void Promise.resolve(result).then(undefined, () => {});
      throw new Error('svstate: effect callback must be synchronous. Use action for async operations.');
    }
  };

  const data = ChangeProxy(stateObject, (target: T, property: string, currentValue: unknown, oldValue: unknown) => {
    if (isDestroyed) return;
    hasChanged = true;
    if (!usedOptions.persistActionError) actionError.set(undefined);
    markDirtyWithParents(property);
    // The value is already written, so a failing effect must not skip plugins or validation
    try {
      const context: EffectContext<T> = { snapshot: createSnapshot, target, property, currentValue, oldValue };
      runEffect(effect, context);
      if (pathEffect) {
        const matchingPaths = getMatchingPaths(Object.keys(pathEffect), property);
        for (const path of matchingPaths) runEffect(pathEffect[path], context);
      }
    } finally {
      callPlugins('onChange', { target, property, currentValue, oldValue });
      if (!isBatching) scheduleValidation();
      scheduleAsyncValidationsForPath(property);
    }
  });

  // Plugins hear about this first result after onInit, once they are set up
  runValidation(false);

  /**
  Runs sync validation immediately (bypassing debounce) and returns the result.
  */
  const validate = (): ValidationResult<V> => {
    clearValidationTimer();
    runValidation();
    const currentErrors = get(errors);
    return { errors: currentErrors, hasErrors: hasAnyErrors(currentErrors) };
  };

  /**
   * Applies many mutations as one unit: validation runs once at the end and each async
   * validator is scheduled at most once. `effect` and plugin `onChange` still fire per mutation.
   */
  const batch = (mutate: (draft: T) => void) => {
    if (isDestroyed) return;
    if (isBatching) {
      mutate(data);
      return;
    }

    isBatching = true;
    try {
      mutate(data);
    } finally {
      isBatching = false;
      if (batchedSnapshotTitle !== undefined) {
        const title = batchedSnapshotTitle;
        batchedSnapshotTitle = undefined;
        createSnapshot(title, isBatchedSnapshotReplace);
      }
      flushDeferredValidation();
    }
  };

  // Run async validation on init if configured
  if (asyncValidator && usedOptions.runAsyncValidationOnInit)
    for (const path of Object.keys(asyncValidator)) scheduleAsyncValidation(path);

  // Makes the current state the new starting point: one "Initial" snapshot, nothing dirty
  const resetBaseline = (shouldClearDirty = true) => {
    if (shouldClearDirty) dirtyFieldsStore.set({});
    snapshots.set([{ title: INITIAL_SNAPSHOT_TITLE, data: deepClone(stateObject) }]);
  };

  // Counted, so with allowConcurrentActions the first action to finish doesn't flip the flag off
  let runningActions = 0;

  const execute = async (parameters?: P) => {
    if (!usedOptions.allowConcurrentActions && runningActions > 0) return;

    callPlugins('onAction', { phase: 'before', params: parameters });
    actionError.set(undefined);
    runningActions++;
    actionInProgress.set(true);
    try {
      let hasFailed = false;
      let failure: unknown;
      try {
        await actuators?.action?.(parameters);
        resetBaseline(usedOptions.resetDirtyOnAction);
      } catch (caughtError) {
        hasFailed = true;
        failure = caughtError;
      }

      // Runs exactly once, and a throw from it is reported like any other action failure
      try {
        await (hasFailed ? actuators?.actionCompleted?.(failure) : actuators?.actionCompleted?.());
      } catch (completedError) {
        if (!hasFailed) {
          hasFailed = true;
          failure = completedError;
        }
      }

      if (hasFailed) {
        const actionError_ = toError(failure);
        actionError.set(actionError_);
        callPlugins('onAction', { phase: 'after', params: parameters, error: actionError_ });
      } else callPlugins('onAction', { phase: 'after', params: parameters });
    } finally {
      runningActions--;
      actionInProgress.set(runningActions > 0);
    }
  };

  // Replaces the live state with a snapshot, including removing keys added since it was taken
  const replaceStateObject = (source: T) => {
    const restored = deepClone(source);
    for (const key of Object.keys(stateObject))
      if (!Object.hasOwn(restored, key)) delete (stateObject as Record<string, unknown>)[key];
    Object.assign(stateObject, restored);
  };

  const restoreToSnapshot = (targetIndex: number, currentSnapshots: Snapshot<T>[]) => {
    const targetSnapshot = currentSnapshots[targetIndex];
    if (!targetSnapshot) return;
    cancelAllAsyncValidations();
    replaceStateObject(targetSnapshot.data);
    snapshots.set(currentSnapshots.slice(0, targetIndex + 1));

    // Restoring a later snapshot still leaves the state different from the initial one
    const initialData = currentSnapshots[0]!.data;
    const changedPaths = targetIndex === 0 ? [] : getChangedPaths(stateObject, initialData);
    dirtyFieldsStore.set({});
    for (const path of changedPaths) markDirtyWithParents(path);

    runValidation();

    // Cancelling dropped every async error, so re-check the values that still differ from
    // the initial state (and everything on reset when validators run on init)
    if (asyncValidator) {
      const pathsToRevalidate = new Set<string>();
      const registeredPaths = Object.keys(asyncValidator);
      if (targetIndex === 0 && usedOptions.runAsyncValidationOnInit)
        for (const path of registeredPaths) pathsToRevalidate.add(path);
      for (const changedPath of changedPaths)
        for (const path of getMatchingPaths(registeredPaths, changedPath)) pathsToRevalidate.add(path);
      for (const path of pathsToRevalidate) scheduleAsyncValidation(path);
    }
    return targetSnapshot;
  };

  const restoreAndNotify = (targetIndex: number, currentSnapshots: Snapshot<T>[]) => {
    const targetSnapshot = restoreToSnapshot(targetIndex, currentSnapshots);
    if (targetSnapshot) callPlugins('onRollback', targetSnapshot);
  };

  const rollback = (steps = 1) => {
    const currentSnapshots = get(snapshots);
    if (currentSnapshots.length <= 1) return;
    restoreAndNotify(Math.max(0, currentSnapshots.length - 1 - steps), currentSnapshots);
  };

  // eslint-disable-next-line unicorn/consistent-boolean-name -- rollbackTo is a public API method name, not a boolean flag
  const rollbackTo = (title: string): boolean => {
    const currentSnapshots = get(snapshots);
    if (currentSnapshots.length <= 1) return false;
    for (let index = currentSnapshots.length - 1; index >= 0; index--)
      if (currentSnapshots[index]!.title === title) {
        restoreAndNotify(index, currentSnapshots);
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
    if (isDestroyed) return;
    isDestroyed = true;

    clearValidationTimer();
    cancelAllAsyncValidations();

    for (let index = plugins.length - 1; index >= 0; index--) {
      const plugin = plugins[index];
      if (plugin) callPlugin(plugin, 'destroy', []);
    }
  };

  // Plugins such as persist/history hydrate state from onInit by writing through the proxy.
  // Defer validation across the hook, then re-baseline so hydrated values count as the initial
  // state instead of as a dirty change on top of it.
  isBatching = true;
  try {
    callPlugins('onInit', { data, state, options: usedOptions, snapshot: createSnapshot });
  } finally {
    isBatching = false;
  }

  // Snapshots taken during hydration are superseded by the re-baseline below
  batchedSnapshotTitle = undefined;

  // Now that every plugin is initialised, report the validation that ran at creation
  if (validator) callPlugins('onValidation', get(errors));

  if (hasChanged) {
    resetBaseline();
    flushDeferredValidation();
  } else batchedAsyncPaths.clear();

  return { data, execute, state, rollback, rollbackTo, reset, destroy, validate, batch };
}
