import { derived, get, type Readable, writable } from 'svelte/store';

import { ChangeProxy, type ProxyChanged } from './proxy';

// Types
type InputObject = Record<string, unknown>;

type Validator = { [S in string]: string | Validator };

type Action<P extends object> = ((parameters: P) => Promise<void> | void) | (() => Promise<void> | void);

type Actuators<P extends object, T extends InputObject, V extends Validator> = {
  validator?: (source: T) => V;
  effect?: ProxyChanged<T>;
  action?: Action<P>;
  actionCompleted?: (error?: unknown) => void;
};

type StateResult<V extends Validator> = {
  errors: Readable<V | undefined>;
  hasErrors: Readable<boolean>;
  isDirty: Readable<boolean>;
  actionInProgress: Readable<boolean>;
  actionError: Readable<Error | undefined>;
};

// Helpers
const checkHasErrors = (validator: Validator): boolean =>
  Object.values(validator).some((item) => (typeof item === 'string' ? !!item : checkHasErrors(item)));
const hasAnyErrors = ($errors: Validator | undefined): boolean => !!$errors && checkHasErrors($errors);

// Options
type Options = {
  resetDirtyOnAction: boolean;
  debounceValidation: number;
  allowConcurrentActions: boolean;
  persistActionError: boolean;
};
const defaultOptions: Options = {
  resetDirtyOnAction: true,
  debounceValidation: 0,
  allowConcurrentActions: false,
  persistActionError: false
};

// createSvState
export function createSvState<T extends InputObject, V extends Validator, P extends object>(
  init: T,
  actuators?: Actuators<P, T, V>,
  options?: Partial<Options>
) {
  const usedOptions: Options = { ...defaultOptions, ...options };

  const { validator, effect } = actuators ?? {};

  const errors = writable<V | undefined>();
  const hasErrors = derived(errors, hasAnyErrors);
  const isDirty = writable(false);
  const actionInProgress = writable(false);
  const actionError = writable<Error | undefined>();

  const stateObject = $state<T>(init);

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
    effect?.(target, property, currentValue, oldValue);
    scheduleValidation();
  });

  if (validator) errors.set(validator(data));

  const execute = async (parameters: P) => {
    if (!usedOptions.allowConcurrentActions && get(actionInProgress)) return;

    actionError.set(undefined);
    actionInProgress.set(true);
    try {
      await actuators?.action?.(parameters);
      if (usedOptions.resetDirtyOnAction) isDirty.set(false);
      actuators?.actionCompleted?.();
    } catch (caughtError) {
      actuators?.actionCompleted?.(caughtError);
      actionError.set(caughtError instanceof Error ? caughtError : undefined);
    } finally {
      actionInProgress.set(false);
    }
  };

  const state: StateResult<V> = {
    errors,
    hasErrors,
    isDirty,
    actionInProgress,
    actionError
  };

  return { data, execute, state };
}
