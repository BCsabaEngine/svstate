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

const defaultSerialize: (value: unknown, field: string) => string = String;
const defaultDeserialize: (parameter: string, field: string) => unknown = (parameter) => parameter;

const getValueAtPath = (source: Record<string, unknown>, path: string): unknown => {
  const parts = path.split('.');
  let current: unknown = source;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

const setValueAtPath = (target: Record<string, unknown>, path: string, value: unknown): void => {
  const parts = path.split('.');
  let current: Record<string, unknown> = target;
  for (let index = 0; index < parts.length - 1; index++) {
    const part = parts[index]!;
    if (current[part] === undefined || current[part] === null) current[part] = {};
    current = current[part] as Record<string, unknown>;
  }
  current[parts.at(-1)!] = value;
};

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

    if (value === undefined || value === null || value === '') url.searchParams.delete(urlParameter);
    else url.searchParams.set(urlParameter, serialize(value, stateField));

    if (mode === 'push') window.history.pushState({}, '', url.toString());
    else window.history.replaceState({}, '', url.toString());
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
      if (event.property in options.fields) updateUrl(event.property);
    },

    destroy() {
      if (popstateHandler && typeof window !== 'undefined') window.removeEventListener('popstate', popstateHandler);
    },

    syncFromUrl() {
      readUrlIntoState();
    }
  };
}
