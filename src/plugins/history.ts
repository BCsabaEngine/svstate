import { deepClone } from '../internal/clone';
import { asRecord, DANGEROUS_KEYS, getMatchingPaths, getValueAtPath, setValueAtPath } from '../internal/paths';
import type { PluginContext, SvStatePlugin } from '../plugin';

export type HistoryOptions = {
  fields: Record<string, string>;
  mode?: 'push' | 'replace';
  deserialize?: (parameter: string, field: string) => unknown;
  serialize?: (value: unknown, field: string) => string;
  onError?: (error: unknown) => void;
};

export type HistoryPluginInstance<T extends Record<string, unknown>> = SvStatePlugin<T> & {
  syncFromUrl(): void;
};

const defaultSerialize: (value: unknown, field: string) => string = String;
const defaultDeserialize: (parameter: string, field: string) => unknown = (parameter) => parameter;

export function historyPlugin<T extends Record<string, unknown>>(options: HistoryOptions): HistoryPluginInstance<T> {
  const mode = options.mode ?? 'replace';
  const serialize = options.serialize ?? defaultSerialize;
  const deserialize = options.deserialize ?? defaultDeserialize;

  let context: PluginContext<T> | undefined;
  let popstateHandler: (() => void) | undefined;
  // Values the fields had before any URL was applied; a param that disappears falls back to these
  const defaults = new Map<string, unknown>();
  // Applying the URL writes through the proxy; that must not be echoed back into the URL,
  // or every back/forward press would push a fresh history entry
  let isReading = false;

  const readUrlIntoState = (shouldResetMissing: boolean) => {
    if (!context || typeof window === 'undefined') return;
    const parameters = new URLSearchParams(window.location.search);
    isReading = true;
    try {
      for (const [stateField, urlParameter] of Object.entries(options.fields)) {
        if (stateField.split('.').some((part) => DANGEROUS_KEYS.has(part))) continue;
        const parameterValue = parameters.get(urlParameter);
        try {
          if (parameterValue !== null)
            setValueAtPath(asRecord(context.data), stateField, deserialize(parameterValue, stateField));
          else if (shouldResetMissing && defaults.has(stateField))
            setValueAtPath(asRecord(context.data), stateField, deepClone(defaults.get(stateField)));
        } catch (error) {
          // A throwing user deserializer must not break the remaining fields, nor escape popstate
          options.onError?.(error);
        }
      }
    } finally {
      isReading = false;
    }
  };

  const updateUrl = (stateField: string) => {
    if (!context || typeof window === 'undefined') return;
    const urlParameter = options.fields[stateField];
    if (!urlParameter) return;

    const value = getValueAtPath(asRecord(context.data), stateField);
    const url = new URL(window.location.href);

    try {
      if (value === '' || value == undefined) url.searchParams.delete(urlParameter);
      else url.searchParams.set(urlParameter, serialize(value, stateField));
    } catch (error) {
      options.onError?.(error);
      return;
    }

    // Nothing to record (e.g. a reset that leaves the URL as it is)
    if (url.href === window.location.href) return;

    if (mode === 'push') window.history.pushState({}, '', url.href);
    else window.history.replaceState({}, '', url.href);
  };

  const updateAllFields = () => {
    for (const stateField of Object.keys(options.fields)) updateUrl(stateField);
  };

  return {
    name: 'history',

    onInit(context_) {
      context = context_;
      for (const stateField of Object.keys(options.fields)) {
        const initialValue = getValueAtPath(asRecord(context_.data), stateField);
        defaults.set(stateField, deepClone(initialValue));
      }
      readUrlIntoState(false);

      if (typeof window !== 'undefined') {
        popstateHandler = () => readUrlIntoState(true);
        window.addEventListener('popstate', popstateHandler);
      }
    },

    onChange(event) {
      if (isReading) return;
      // Dotted fields must react both ways: replacing `filters` affects the registered
      // `filters.q`, and mutating `filters.q` affects a registered `filters`.
      const affectedFields = getMatchingPaths(Object.keys(options.fields), event.property);
      for (const stateField of affectedFields) updateUrl(stateField);
    },

    // Rollback and reset restore state without going through the proxy, so no onChange fires
    onRollback() {
      updateAllFields();
    },

    onReset() {
      updateAllFields();
    },

    destroy() {
      if (popstateHandler && typeof window !== 'undefined') window.removeEventListener('popstate', popstateHandler);
    },

    syncFromUrl() {
      readUrlIntoState(true);
    }
  };
}
