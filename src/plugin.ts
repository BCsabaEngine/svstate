import type { Snapshot, SnapshotFunction, StateResult, SvStateOptions, Validator } from './state.svelte';

/** The same stores `createSvState` returns, with errors widened to the untyped shape. */
export type PluginStores<T> = StateResult<T, Validator>;

export type PluginContext<T extends Record<string, unknown>> = {
  data: T;
  state: PluginStores<T>;
  options: Readonly<SvStateOptions>;
  snapshot: SnapshotFunction;
};

export type ChangeEvent<T> = {
  target: T;
  property: string;
  currentValue: unknown;
  oldValue: unknown;
};

export type ActionEvent = {
  phase: 'before' | 'after';
  params?: unknown;
  error?: Error;
};

export type SvStatePlugin<T extends Record<string, unknown>> = {
  name: string;
  onInit?(context: PluginContext<T>): void;
  onChange?(event: ChangeEvent<T>): void;
  onValidation?(errors: Validator | undefined): void;
  onSnapshot?(snapshot: Snapshot<T>): void;
  onAction?(event: ActionEvent): void;
  onRollback?(snapshot: Snapshot<T>): void;
  onReset?(): void;
  destroy?(): void;
};
