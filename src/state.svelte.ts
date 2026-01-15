import { derived, writable } from 'svelte/store';

import { ChangeProxy, type ProxyChanged } from './proxy';

// Types
type InputObject = Record<string, unknown>;

type Validator = { [S in string]: string | Validator };
const allValid = (validator: Validator): boolean =>
  Object.values(validator).every((item) => (typeof item === 'string' ? !item : allValid(item)));

type Action<P extends object> = ((parameters: P) => Promise<void> | void) | (() => Promise<void> | void);

type Actuators<P extends object, T extends InputObject, V extends Validator> = {
  action?: Action<P>;
  validator?: (source: T) => V;
  changed?: ProxyChanged<T>;
  submitted?: (error?: unknown) => void;
};

// Options
type Options = {
  clearErrorOnChange: boolean;
};
const defaultOptions: Options = {
  clearErrorOnChange: true
};

// FormLogic
export class SvState<T extends InputObject, V extends Validator, P extends object> {
  private _stateObject = $state<T>({} as T);
  private _data: T;

  private _isValid = writable<V | undefined>();

  private _allValid = derived(
    this._isValid,
    // eslint-disable-next-line unicorn/consistent-function-scoping
    ($isValid) => !$isValid || allValid($isValid)
  );
  private _isDirty = writable(false);
  private _inProgress = writable(false);
  private _error = writable<Error | undefined>();

  private _actuators?: Actuators<P, T, V> | undefined;

  private _execute = async (parameters: P) => {
    this._error.set(undefined);
    this._inProgress.set(true);
    try {
      await this._actuators?.action?.(parameters);
      this._actuators?.submitted?.();
    } catch (error) {
      this._actuators?.submitted?.(error);
      this._error.set(error instanceof Error ? error : undefined);
    } finally {
      this._inProgress.set(false);
    }
  };

  constructor(init: T, actuators?: Actuators<P, T, V>, options?: Partial<Options>) {
    const usedOptions: Options = { ...defaultOptions, ...options };

    this._actuators = actuators;

    this._stateObject = init;
    this._data = ChangeProxy(
      this._stateObject,
      (target: T, property: string, currentValue: unknown, oldValue: unknown) => {
        this._stateObject = target;
        if (usedOptions.clearErrorOnChange) this._error.set(undefined);
        this._isDirty.set(true);
        if (actuators?.changed) actuators.changed(target, property, currentValue, oldValue);
        if (actuators?.validator) this._isValid.set(actuators.validator ? actuators.validator(this._data) : undefined);
      }
    );

    if (actuators?.validator) this._isValid.set(actuators.validator ? actuators.validator(this._data) : undefined);
  }

  get data() {
    return this._data;
  }

  get execute() {
    return this._execute;
  }

  get state() {
    return {
      isValid: this._isValid,
      allValid: this._allValid,
      isDirty: this._isDirty,
      inProgress: this._inProgress,
      error: this._error
    };
  }
}
