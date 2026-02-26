import type { Readable } from 'svelte/store';

import type { AsyncErrors, DirtyFields, Snapshot, SnapshotFunction, SvStateOptions, Validator } from './state.svelte';

export type PluginStores<T> = {
  errors: Readable<Validator | undefined>;
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
