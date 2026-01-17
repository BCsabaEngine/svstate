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

type Actuators<T extends Record<string, unknown>, V extends Validator, P extends object> = {
  validator?: (source: T) => V;
  effect?: (context: EffectContext<T>) => void;
  action?: Action<P>;
  actionCompleted?: (error?: unknown) => void | Promise<void>;
};

type StateResult<T, V> = {
  errors: Readable<V | undefined>;
  hasErrors: Readable<boolean>;
  isDirty: Readable<boolean>;
  actionInProgress: Readable<boolean>;
  actionError: Readable<Error | undefined>;
  snapshots: Readable<Snapshot<T>[]>;
};

// Helpers
const checkHasErrors = (validator: Validator): boolean =>
  Object.values(validator).some((item) => (typeof item === 'string' ? !!item : checkHasErrors(item)));
const hasAnyErrors = ($errors: Validator | undefined): boolean => !!$errors && checkHasErrors($errors);

const deepClone = <T>(object: T): T => {
  if (object === null || typeof object !== 'object') return object;
  if (object instanceof Date) return new Date(object) as T;
  if (Array.isArray(object)) return object.map((item) => deepClone(item)) as T;
  const cloned = {} as T;
  for (const key of Object.keys(object)) cloned[key as keyof T] = deepClone(object[key as keyof T]);
  return cloned;
};

// Options
export type SvStateOptions = {
  resetDirtyOnAction: boolean;
  debounceValidation: number;
  allowConcurrentActions: boolean;
  persistActionError: boolean;
};
const defaultOptions: SvStateOptions = {
  resetDirtyOnAction: true,
  debounceValidation: 0,
  allowConcurrentActions: false,
  persistActionError: false
};

// createSvState
export function createSvState<T extends Record<string, unknown>, V extends Validator, P extends object>(
  init: T,
  actuators?: Actuators<T, V, P>,
  options?: Partial<SvStateOptions>
) {
  const usedOptions: SvStateOptions = { ...defaultOptions, ...options };

  const { validator, effect } = actuators ?? {};

  const errors = writable<V | undefined>();
  const hasErrors = derived(errors, hasAnyErrors);
  const isDirty = writable(false);
  const actionInProgress = writable(false);
  const actionError = writable<Error | undefined>();
  const snapshots = writable<Snapshot<T>[]>([{ title: 'Initial', data: deepClone(init) }]);

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

  const data = ChangeProxy(stateObject, (target: T, property: string, currentValue: unknown, oldValue: unknown) => {
    if (!usedOptions.persistActionError) actionError.set(undefined);
    isDirty.set(true);
    const effectResult: unknown = effect?.({ snapshot: createSnapshot, target, property, currentValue, oldValue });
    if (effectResult instanceof Promise)
      throw new Error('svstate: effect callback must be synchronous. Use action for async operations.');
    scheduleValidation();
  });

  if (validator) errors.set(validator(data));

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

    Object.assign(stateObject, deepClone(targetSnapshot.data));
    snapshots.set(currentSnapshots.slice(0, targetIndex + 1));

    if (validator) errors.set(validator(data));
  };

  const reset = () => {
    const currentSnapshots = get(snapshots);
    const initialSnapshot = currentSnapshots[0];
    if (!initialSnapshot) return;

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
    snapshots
  };

  return { data, execute, state, rollback, reset };
}
