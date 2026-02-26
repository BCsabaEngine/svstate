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

export function autosavePlugin<T extends Record<string, unknown>>(
  options: AutosaveOptions<T>
): SvStatePlugin<T> & { saveNow(): Promise<void>; isSaving(): boolean } {
  const idleMs = options.idle ?? 1000;
  const intervalMs = options.interval ?? 0;
  const saveOnDestroy = options.saveOnDestroy ?? true;
  const onlyWhenDirty = options.onlyWhenDirty ?? true;

  let context: PluginContext<T> | undefined;
  let idleTimeout: ReturnType<typeof setTimeout> | undefined;
  let intervalTimer: ReturnType<typeof setInterval> | undefined;
  let saving = false;
  let destroyed = false;

  const doSave = async () => {
    if (!context) return;
    if (onlyWhenDirty && !get(context.state.isDirty)) return;
    if (saving) return;

    saving = true;
    try {
      await options.save(context.data);
    } catch (error) {
      options.onError?.(error);
    } finally {
      saving = false;
    }
  };

  const scheduleIdleSave = () => {
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(doSave, idleMs);
  };

  const handleVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') doSave();
  };

  const plugin: SvStatePlugin<T> & { saveNow(): Promise<void>; isSaving(): boolean } = {
    name: 'autosave',

    onInit(context_) {
      context = context_;

      if (intervalMs > 0) intervalTimer = setInterval(doSave, intervalMs);

      if (options.onVisibilityHidden && typeof document !== 'undefined')
        document.addEventListener('visibilitychange', handleVisibility);
    },

    onChange() {
      scheduleIdleSave();
    },

    onAction(event) {
      if (event.phase === 'after' && !event.error) clearTimeout(idleTimeout);
    },

    destroy() {
      destroyed = true;
      clearTimeout(idleTimeout);
      if (intervalTimer !== undefined) clearInterval(intervalTimer);

      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibility);

      if (saveOnDestroy && context) {
        saving = false;
        // Fire-and-forget save on destroy
        const shouldSave = !onlyWhenDirty || get(context.state.isDirty);
        if (shouldSave)
          try {
            options.save(context.data);
          } catch (error) {
            options.onError?.(error);
          }
      }
    },

    async saveNow() {
      if (destroyed) return;
      clearTimeout(idleTimeout);
      saving = false;
      await doSave();
    },

    isSaving() {
      return saving;
    }
  };

  return plugin;
}
