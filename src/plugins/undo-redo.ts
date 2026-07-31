import { get, type Readable, writable } from 'svelte/store';

import { deepClone } from '../internal/clone';
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
  let isApplyingRedo = false;

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
      if (!previousTipSnapshot) return;

      redoStore.update((stack) => {
        const updated = [...stack, previousTipSnapshot!];
        const max = options?.maxRedoStack;
        return max && max > 0 ? updated.slice(-max) : updated;
      });
      previousTipSnapshot = undefined;
    },

    onChange() {
      // Applying a redo mutates state; that must not wipe the rest of the redo stack.
      if (isApplyingRedo) return;
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

      isApplyingRedo = true;
      try {
        // Create a snapshot of current state before redo. Each redo step keeps its own
        // snapshot, so a later rollback undoes one step at a time.
        context.snapshot('Undo', false);
        // Apply the redo target data
        Object.assign(context.data, deepClone(targetSnapshot.data));
      } finally {
        isApplyingRedo = false;
      }
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
