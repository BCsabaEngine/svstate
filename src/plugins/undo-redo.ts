import { get, type Readable, writable } from 'svelte/store';

import type { PluginContext, SvStatePlugin } from '../plugin';
import type { Snapshot } from '../state.svelte';

export type UndoRedoPluginInstance<T extends Record<string, unknown>> = SvStatePlugin<T> & {
  redo(): void;
  canRedo(): boolean;
  redoStack: Readable<Snapshot<T>[]>;
};

export function undoRedoPlugin<T extends Record<string, unknown>>(): UndoRedoPluginInstance<T> {
  const redoStore = writable<Snapshot<T>[]>([]);
  let cachedSnapshots: Snapshot<T>[] = [];
  let context: PluginContext<T> | undefined;
  let unsubscribe: (() => void) | undefined;

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
        cachedSnapshots = snaps;
      });
    },

    onRollback() {
      // The pre-rollback state: the last snapshot from cached list before rollback truncated it
      // After rollback, snapshots store is already truncated, but cachedSnapshots
      // may have been updated by the subscription. We need the snapshot that was at the tip
      // before rollback. Since onRollback fires after restoreToSnapshot which sets the store,
      // the subscription has already fired. The "abandoned" snapshot is the one that was
      // at the end of the previous cachedSnapshots list — but we can reconstruct it from
      // the current data before rollback. Actually, the simplest approach:
      // When onRollback fires, we know the current state of `data` has already been restored.
      // The snapshot we abandoned is the state BEFORE rollback. We capture this by looking at
      // what the snapshot list looked like before truncation.
      // Since subscription fires synchronously, cachedSnapshots is already the truncated list.
      // We need to save a snapshot of the data BEFORE it was restored.
      // The best approach: we track the last snapshot that was at the tip before rollback.
      // However, since the subscription fires before onRollback, we lose it.
      // Solution: Instead, we capture the current state snapshot list length changes.
      // Actually: We can capture from the cached snapshots BEFORE the update.
      // Let's use a different approach — store the last known tip snapshot.

      // Since we get called AFTER restoreToSnapshot, and the subscription already updated,
      // we need to reconstruct what was abandoned. The simplest correct approach:
      // We don't need the exact abandoned snapshot — we just need a snapshot of the state
      // that was active before rollback. We can get this because the subscription gives us
      // updates synchronously, and we can track the "previous" tip.

      // For now, we use the approach of caching snapshots before rollback via the subscription.
      // The subscription fires synchronously when snapshots.set() is called in restoreToSnapshot.
      // But onRollback fires AFTER restoreToSnapshot, so cachedSnapshots already has the new list.
      // This means we need to save the pre-rollback data separately.

      // Actually the simplest correct solution: since the snapshots from before rollback
      // included the state we want to redo to (it was the last snapshot), and after rollback
      // the list is truncated, we just need to check what was removed.
      // But we already lost that info since the subscription updated cachedSnapshots.

      // Best practical solution: track the "tip" before any rollback.
      // We'll do this by saving previousSnapshots in the subscription.
      // This has been refactored — see the subscription below.

      // With the refactored approach, previousTipSnapshot is set by the subscription
      // before cachedSnapshots is updated. We push that to the redo stack.
      if (previousTipSnapshot) {
        redoStore.update((stack) => [...stack, previousTipSnapshot!]);
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

  let previousTipSnapshot: Snapshot<T> | undefined;

  // Override onInit to set up the tracking subscription
  const originalOnInit = plugin.onInit!;
  plugin.onInit = (context_) => {
    context = context_;
    unsubscribe = context_.state.snapshots.subscribe((snaps) => {
      // If snapshots got shorter, it was a rollback — save the previous tip
      if (snaps.length < cachedSnapshots.length && cachedSnapshots.length > 0)
        previousTipSnapshot = cachedSnapshots.at(-1);

      cachedSnapshots = snaps;
    });
    // Don't call original onInit since we replaced the subscription logic
    void originalOnInit;
  };

  return plugin;
}
