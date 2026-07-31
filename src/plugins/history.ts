import { DANGEROUS_KEYS, getValueAtPath, setValueAtPath } from '../internal/paths';
import type { PluginContext, SvStatePlugin } from '../plugin';

export type HistoryOptions = {
  fields: Record<string, string>;
  mode?: 'push' | 'replace';
  deserialize?: (parameter: string, field: string) => unknown;
  serialize?: (value: unknown, field: string) => string;
};

export type HistoryPluginInstance<T extends Record<string, unknown>> = SvStatePlugin<T> & {
  syncFromUrl(): void;
};

const isNullOrUndefined = (value: unknown): boolean => value === undefined || value === null;

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
      if (parameterValue !== null) {
        const value = deserialize(parameterValue, stateField);
        setValueAtPath(context.data as unknown as Record<string, unknown>, stateField, value);
      }
    }
  };

  const updateUrl = (stateField: string) => {
    if (!context || typeof window === 'undefined') return;
    const urlParameter = options.fields[stateField];
    if (!urlParameter) return;

    const value = getValueAtPath(context.data as unknown as Record<string, unknown>, stateField);
    const url = new URL(window.location.href);

    if (value === '' || isNullOrUndefined(value)) url.searchParams.delete(urlParameter);
    else url.searchParams.set(urlParameter, serialize(value, stateField));

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
      if (Object.hasOwn(options.fields, event.property)) updateUrl(event.property);
    },

    destroy() {
      if (popstateHandler && typeof window !== 'undefined') window.removeEventListener('popstate', popstateHandler);
    },

    syncFromUrl() {
      readUrlIntoState();
    }
  };
}
