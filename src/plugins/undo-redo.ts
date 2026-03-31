import { get, type Readable, writable } from 'svelte/store';

import type { PluginContext, SvStatePlugin } from '../plugin';
import type { Snapshot } from '../state.svelte';

export type UndoRedoOptions = {
  maxRedoStack?: number;
};

export type UndoRedoPluginInstance<T extends Record<string, unknown>> = SvStatePlugin<T> & {
  redo(): void;
  canRedo(): boolean;
  redoStack: Readable<Snapshot<T>[]>;
};

export function undoRedoPlugin<T extends Record<string, unknown>>(
  options?: UndoRedoOptions
): UndoRedoPluginInstance<T> {
  const redoStore = writable<Snapshot<T>[]>([]);
  let cachedSnapshots: Snapshot<T>[] = [];
  let context: PluginContext<T> | undefined;
  let unsubscribe: (() => void) | undefined;
  let previousTipSnapshot: Snapshot<T> | undefined;

  const deepClone = <U>(object: U): U => {
    if (object === null || typeof object !== 'object') return object;
    if (object instanceof Date) return new Date(object) as U;
    if (Array.isArray(object)) return object.map((item) => deepClone(item)) as U;
    const cloned = Object.create(Object.getPrototypeOf(object)) as U;
    for (const key of Object.keys(object)) cloned[key as keyof U] = deepClone(object[key as keyof U]);
    return cloned;
  };

  const plugin: UndoRedoPluginInstance<T> = {
    name: 'undo-redo',
    redoStack: { subscribe: redoStore.subscribe },

    onInit(context_) {
      context = context_;
      unsubscribe = context_.state.snapshots.subscribe((snaps) => {
        // If snapshots got shorter, it was a rollback — save the previous tip for redo
        if (snaps.length < cachedSnapshots.length && cachedSnapshots.length > 0)
          previousTipSnapshot = cachedSnapshots.at(-1);

        cachedSnapshots = snaps;
      });
    },

    onRollback() {
      // previousTipSnapshot is captured by the subscription (which fires synchronously
      // before onRollback) when it detects the snapshot list shrinking.
      if (previousTipSnapshot) {
        redoStore.update((stack) => {
          const updated = [...stack, previousTipSnapshot!];
          const max = options?.maxRedoStack;
          return max && max > 0 ? updated.slice(-max) : updated;
        });
        previousTipSnapshot = undefined;
      }
    },

    onChange() {
      redoStore.set([]);
    },

    onReset() {
      redoStore.set([]);
    },

    redo() {
      if (!context) return;
      const stack = get(redoStore);
      if (stack.length === 0) return;

      const targetSnapshot = stack.at(-1)!;
      redoStore.set(stack.slice(0, -1));

      // Create a snapshot of current state before redo
      context.snapshot('Undo');

      // Apply the redo target data
      Object.assign(context.data, deepClone(targetSnapshot.data));
    },

    canRedo() {
      return get(redoStore).length > 0;
    },

    destroy() {
      unsubscribe?.();
    }
  };

  return plugin;
}
