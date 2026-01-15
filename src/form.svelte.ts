import { derived, writable } from 'svelte/store';

import { ChangeProxy, type ProxyChanged } from './proxy';

// Types
type InputObject = Record<string, unknown>;

type Validator = { [S in string]: string | Validator };
const allValid = (validator: Validator): boolean =>
  Object.values(validator).every((item) => (typeof item === 'string' ? !item : allValid(item)));

type Action<P extends object> = ((parameters: P) => Promise<void> | void) | (() => Promise<void> | void);

type Actuators<T extends InputObject, V extends Validator> = {
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
export class FormLogic<T extends InputObject, V extends Validator, P extends object> {
  private _stateObject = $state<T>({} as T);
  private _formData: T;

  private _stateIsValid = writable<V | undefined>();

  private _stateAllValid = derived(
    this._stateIsValid,
    // eslint-disable-next-line unicorn/consistent-function-scoping
    ($stateIsValid) => !$stateIsValid || allValid($stateIsValid)
  );
  private _stateIsDirty = writable(false);
  private _stateInProgress = writable(false);
  private _stateError = writable<Error | undefined>();

  private _action: Action<P>;
  private _actuators?: Actuators<T, V> | undefined;

  private _formExecute = async (parameters: P) => {
    this._stateError.set(undefined);
    this._stateInProgress.set(true);
    try {
      await this._action(parameters);
      this._actuators?.submitted?.();
    } catch (error) {
      this._actuators?.submitted?.(error);
      this._stateError.set(error instanceof Error ? error : undefined);
    } finally {
      this._stateInProgress.set(false);
    }
  };

  constructor(init: T, action: Action<P>, actuators?: Actuators<T, V>, options?: Partial<Options>) {
    const usedOptions: Options = { ...defaultOptions, ...options };

    this._action = action;
    this._actuators = actuators;

    this._stateObject = init;
    this._formData = ChangeProxy(
      this._stateObject,
      (target: T, property: string, currentValue: unknown, oldValue: unknown) => {
        this._stateObject = target;
        if (usedOptions.clearErrorOnChange) this._stateError.set(undefined);
        this._stateIsDirty.set(true);
        if (actuators?.changed) actuators.changed(target, property, currentValue, oldValue);
        if (actuators?.validator)
          this._stateIsValid.set(actuators.validator ? actuators.validator(this._formData) : undefined);
      }
    );

    if (actuators?.validator)
      this._stateIsValid.set(actuators.validator ? actuators.validator(this._formData) : undefined);
  }

  get formData() {
    return this._formData;
  }

  get formExecute() {
    return this._formExecute;
  }

  get formState() {
    return {
      stateIsValid: this._stateIsValid,
      stateAllValid: this._stateAllValid,
      stateIsDirty: this._stateIsDirty,
      stateInProgress: this._stateInProgress,
      stateError: this._stateError
    };
  }
}
