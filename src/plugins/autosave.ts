import { get } from 'svelte/store';

import { createDebouncer } from '../internal/timers';
import type { PluginContext, SvStatePlugin } from '../plugin';

export type AutosaveOptions<T> = {
  save: (data: T) => Promise<void> | void;
  idle?: number;
  interval?: number;
  onVisibilityHidden?: boolean;
  saveOnDestroy?: boolean;
  onlyWhenDirty?: boolean;
  onError?: (error: unknown) => void;
};

export type AutosavePluginInstance<T extends Record<string, unknown>> = SvStatePlugin<T> & {
  saveNow(): Promise<void>;
  isSaving(): boolean;
};

export function autosavePlugin<T extends Record<string, unknown>>(
  options: AutosaveOptions<T>
): AutosavePluginInstance<T> {
  const idleMs = options.idle ?? 1000;
  const intervalMs = options.interval ?? 0;
  const saveOnDestroy = options.saveOnDestroy ?? true;
  const onlyWhenDirty = options.onlyWhenDirty ?? true;

  let context: PluginContext<T> | undefined;
  let intervalTimer: ReturnType<typeof setInterval> | undefined;
  let hasVisibilityListener = false;
  let isSaving = false;
  let isDestroyed = false;
  let hasPendingSave = false;

  const doSave = async () => {
    if (!context) return;
    if (onlyWhenDirty && !get(context.state.isDirty)) return;
    // A save requested mid-flight is not dropped — it runs once the current one settles
    if (isSaving) {
      hasPendingSave = true;
      return;
    }

    isSaving = true;
    try {
      await options.save(context.data);
    } catch (error) {
      options.onError?.(error);
    } finally {
      isSaving = false;
    }

    if (hasPendingSave && !isDestroyed) {
      hasPendingSave = false;
      await doSave();
    }
  };

  const idleSaver = createDebouncer(() => void doSave(), idleMs);

  const handleVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') doSave();
  };

  const plugin: AutosavePluginInstance<T> = {
    name: 'autosave',

    onInit(context_) {
      context = context_;

      if (intervalMs > 0) intervalTimer = setInterval(doSave, intervalMs);

      if (typeof document !== 'undefined' && options.onVisibilityHidden) {
        document.addEventListener('visibilitychange', handleVisibility);
        hasVisibilityListener = true;
      }
    },

    onChange() {
      idleSaver.schedule();
    },

    onAction(event) {
      if (event.phase === 'after' && !event.error) idleSaver.cancel();
    },

    destroy() {
      isDestroyed = true;
      hasPendingSave = false;
      idleSaver.cancel();
      if (intervalTimer !== undefined) clearInterval(intervalTimer);

      if (hasVisibilityListener) {
        document.removeEventListener('visibilitychange', handleVisibility);
        hasVisibilityListener = false;
      }

      // Fire-and-forget: doSave already applies the onlyWhenDirty check and the error guard
      if (saveOnDestroy && context) {
        isSaving = false;
        void doSave();
      }
    },

    async saveNow() {
      if (isDestroyed) return;
      idleSaver.cancel();
      isSaving = false;
      hasPendingSave = false;
      await doSave();
    },

    isSaving() {
      return isSaving;
    }
  };

  return plugin;
}
