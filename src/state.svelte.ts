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

// FormLogic
export class SvState<T extends InputObject, V extends Validator, P extends object> {
  private _stateObject = $state<T>({} as T);
  private _data: T;

  private _errors = writable<V | undefined>();
  private _allValid = derived(this._errors, isAllValid);
  private _isDirty = writable(false);
  private _actionInProgress = writable(false);
  private _error = writable<Error | undefined>();

  private _actuators?: Actuators<P, T, V>;
  private _state!: StateResult<V>;

  private _execute = async (parameters: P) => {
    this._error.set(undefined);
    this._actionInProgress.set(true);
    try {
      await this._actuators?.action?.(parameters);
      this._actuators?.actionCompleted?.();
    } catch (error) {
      this._actuators?.actionCompleted?.(error);
      this._error.set(error instanceof Error ? error : undefined);
    } finally {
      this._actionInProgress.set(false);
    }
  };

  constructor(init: T, actuators?: Actuators<P, T, V>, options?: Partial<Options>) {
    const usedOptions: Options = { ...defaultOptions, ...options };
    this._actuators = actuators;

    const { validator, effect } = actuators ?? {};

    this._stateObject = init;
    this._data = ChangeProxy(
      this._stateObject,
      (target: T, property: string, currentValue: unknown, oldValue: unknown) => {
        if (usedOptions.clearErrorOnChange) this._error.set(undefined);
        this._isDirty.set(true);
        effect?.(target, property, currentValue, oldValue);
        if (validator) this._errors.set(validator(this._data));
      }
    );

    if (validator) this._errors.set(validator(this._data));

    this._state = {
      errors: this._errors,
      allValid: this._allValid,
      isDirty: this._isDirty,
      actionInProgress: this._actionInProgress,
      error: this._error
    };
  }

  get data() {
    return this._data;
  }

  get execute() {
    return this._execute;
  }

  get state(): StateResult<V> {
    return this._state;
  }
}
