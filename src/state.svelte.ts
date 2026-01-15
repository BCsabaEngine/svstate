import { derived, type Readable, writable } from 'svelte/store';

import { ChangeProxy, type ProxyChanged } from './proxy';

// Types
type InputObject = Record<string, unknown>;

type Validator = { [S in string]: string | Validator };
const allValid = (validator: Validator): boolean =>
  Object.values(validator).every((item) => (typeof item === 'string' ? !item : allValid(item)));
const isAllValid = ($isValid: Validator | undefined): boolean => !$isValid || allValid($isValid);

type Action<P extends object> = ((parameters: P) => Promise<void> | void) | (() => Promise<void> | void);

type Actuators<P extends object, T extends InputObject, V extends Validator> = {
  action?: Action<P>;
  validator?: (source: T) => V;
  effect?: ProxyChanged<T>;
  actionCompleted?: (error?: unknown) => void;
};

type StateResult<V extends Validator> = {
  errors: Readable<V | undefined>;
  allValid: Readable<boolean>;
  isDirty: Readable<boolean>;
  actionInProgress: Readable<boolean>;
  error: Readable<Error | undefined>;
};

// Options
type Options = {
  clearErrorOnChange: boolean;
};
const defaultOptions: Options = {
  clearErrorOnChange: true
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
  const allValidStore = derived(errors, isAllValid);
  const isDirty = writable(false);
  const actionInProgress = writable(false);
  const error = writable<Error | undefined>();

  const stateObject = $state<T>(init);

  let validationScheduled = false;
  const scheduleValidation = () => {
    if (validationScheduled || !validator) return;
    validationScheduled = true;
    queueMicrotask(() => {
      errors.set(validator(data));
      validationScheduled = false;
    });
  };

  const data = ChangeProxy(stateObject, (target: T, property: string, currentValue: unknown, oldValue: unknown) => {
    if (usedOptions.clearErrorOnChange) error.set(undefined);
    isDirty.set(true);
    effect?.(target, property, currentValue, oldValue);
    scheduleValidation();
  });

  if (validator) errors.set(validator(data));

  const execute = async (parameters: P) => {
    error.set(undefined);
    actionInProgress.set(true);
    try {
      await actuators?.action?.(parameters);
      actuators?.actionCompleted?.();
    } catch (caughtError) {
      actuators?.actionCompleted?.(caughtError);
      error.set(caughtError instanceof Error ? caughtError : undefined);
    } finally {
      actionInProgress.set(false);
    }
  };

  const state: StateResult<V> = {
    errors,
    allValid: allValidStore,
    isDirty,
    actionInProgress,
    error
  };

  return { data, execute, state };
}
