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

  const readUrlIntoState = () => {
    if (!context || typeof window === 'undefined') return;
    const parameters = new URLSearchParams(window.location.search);
    for (const [stateField, urlParameter] of Object.entries(options.fields)) {
      if (stateField.split('.').some((part) => DANGEROUS_KEYS.has(part))) continue;
      const parameterValue = parameters.get(urlParameter);
      if (parameterValue === null) continue;
      try {
        setValueAtPath(asRecord(context.data), stateField, deserialize(parameterValue, stateField));
      } catch (error) {
        // A throwing user deserializer must not break the remaining fields, nor escape popstate
        options.onError?.(error);
      }
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

    if (mode === 'push') window.history.pushState({}, '', url.href);
    else window.history.replaceState({}, '', url.href);
  };

  return {
    name: 'history',

    onInit(context_) {
      context = context_;
      readUrlIntoState();

      if (typeof window !== 'undefined') {
        popstateHandler = () => readUrlIntoState();
        window.addEventListener('popstate', popstateHandler);
      }
    },

    onChange(event) {
      // Dotted fields must react both ways: replacing `filters` affects the registered
      // `filters.q`, and mutating `filters.q` affects a registered `filters`.
      const affectedFields = getMatchingPaths(Object.keys(options.fields), event.property);
      for (const stateField of affectedFields) updateUrl(stateField);
    },

    destroy() {
      if (popstateHandler && typeof window !== 'undefined') window.removeEventListener('popstate', popstateHandler);
    },

    syncFromUrl() {
      readUrlIntoState();
    }
  };
}
