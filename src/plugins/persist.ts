import type { SvStatePlugin } from '../plugin';

export type PersistOptions = {
  key: string;
  storage?: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  };
  throttle?: number;
  version?: number;
  migrate?: (persisted: unknown, version: number) => unknown;
  include?: string[];
  exclude?: string[];
};

type StorageFormat = {
  version: number;
  data: Record<string, unknown>;
};

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

const filterData = (data: Record<string, unknown>, include?: string[], exclude?: string[]): Record<string, unknown> => {
  if (include) {
    const filtered: Record<string, unknown> = {};
    for (const path of include) {
      const value = getValueAtPath(data, path);
      if (value !== undefined) setValueAtPath(filtered, path, value);
    }
    return filtered;
  }
  if (exclude) {
    const filtered = { ...data };
    for (const path of exclude) {
      const parts = path.split('.');
      if (parts.length === 1) delete filtered[path];
      else {
        let current: Record<string, unknown> = filtered;
        for (let index = 0; index < parts.length - 1; index++) {
          const part = parts[index]!;
          if (current[part] === undefined) break;
          if (index === parts.length - 2) {
            const parent = current[part] as Record<string, unknown>;
            current[part] = { ...parent };
            delete (current[part] as Record<string, unknown>)[parts.at(-1)!];
          } else {
            current[part] = { ...(current[part] as Record<string, unknown>) };
            current = current[part] as Record<string, unknown>;
          }
        }
      }
    }
    return filtered;
  }
  return data;
};

export function persistPlugin<T extends Record<string, unknown>>(
  options: PersistOptions
): SvStatePlugin<T> & { clearPersistedState(): void; isRestored(): boolean } {
  const storage = options.storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
  const throttleMs = options.throttle ?? 300;
  const version = options.version ?? 1;

  let restored = false;
  let pendingTimeout: ReturnType<typeof setTimeout> | undefined;
  let contextData: T | undefined;

  const writeToStorage = () => {
    if (!storage || !contextData) return;
    const filtered = filterData(contextData as unknown as Record<string, unknown>, options.include, options.exclude);
    const payload: StorageFormat = { version, data: filtered };
    storage.setItem(options.key, JSON.stringify(payload));
  };

  const scheduleWrite = () => {
    clearTimeout(pendingTimeout);
    pendingTimeout = setTimeout(writeToStorage, throttleMs);
  };

  const plugin: SvStatePlugin<T> & { clearPersistedState(): void; isRestored(): boolean } = {
    name: 'persist',

    onInit(context) {
      contextData = context.data;
      if (!storage) return;

      const raw = storage.getItem(options.key);
      if (!raw) return;

      try {
        let parsed = JSON.parse(raw) as StorageFormat;
        if (options.migrate && parsed.version !== version)
          parsed = { version, data: options.migrate(parsed.data, parsed.version) as Record<string, unknown> };

        Object.assign(context.data, parsed.data);
        restored = true;
      } catch {
        // Invalid stored data — ignore
      }
    },

    onChange() {
      scheduleWrite();
    },

    onReset() {
      writeToStorage();
    },

    destroy() {
      if (pendingTimeout !== undefined) {
        clearTimeout(pendingTimeout);
        writeToStorage();
      }
    },

    clearPersistedState() {
      storage?.removeItem(options.key);
    },

    isRestored() {
      return restored;
    }
  };

  return plugin;
}
