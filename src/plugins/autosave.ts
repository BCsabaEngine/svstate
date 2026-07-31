import { get } from 'svelte/store';

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
  let idleTimeout: ReturnType<typeof setTimeout> | undefined;
  let intervalTimer: ReturnType<typeof setInterval> | undefined;
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

  const scheduleIdleSave = () => {
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(doSave, idleMs);
  };

  const handleVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') doSave();
  };

  const plugin: AutosavePluginInstance<T> = {
    name: 'autosave',

    onInit(context_) {
      context = context_;

      if (intervalMs > 0) intervalTimer = setInterval(doSave, intervalMs);

      if (typeof document !== 'undefined' && options.onVisibilityHidden)
        document.addEventListener('visibilitychange', handleVisibility);
    },

    onChange() {
      scheduleIdleSave();
    },

    onAction(event) {
      if (event.phase === 'after' && !event.error) clearTimeout(idleTimeout);
    },

    destroy() {
      isDestroyed = true;
      hasPendingSave = false;
      clearTimeout(idleTimeout);
      if (intervalTimer !== undefined) clearInterval(intervalTimer);

      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibility);

      if (saveOnDestroy && context) {
        isSaving = false;
        const activeContext = context;
        // Fire-and-forget save on destroy
        const shouldSave = !onlyWhenDirty || get(activeContext.state.isDirty);
        if (shouldSave) {
          const trySave = async () => {
            try {
              await options.save(activeContext.data);
            } catch (error) {
              options.onError?.(error);
            }
          };
          void trySave();
        }
      }
    },

    async saveNow() {
      if (isDestroyed) return;
      clearTimeout(idleTimeout);
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
