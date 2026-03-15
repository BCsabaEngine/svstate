import type { SvStatePlugin } from '../plugin';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isValidStorageFormat = (value: unknown): value is StorageFormat =>
  isPlainObject(value) &&
  typeof (value as StorageFormat).version === 'number' &&
  isPlainObject((value as StorageFormat).data);

const safeMerge = (target: Record<string, unknown>, source: Record<string, unknown>): void => {
  for (const key of Object.keys(source)) if (!DANGEROUS_KEYS.has(key)) target[key] = source[key];
};

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
    if (DANGEROUS_KEYS.has(part)) return;
    if (current[part] === undefined || current[part] === null) current[part] = {};
    current = current[part] as Record<string, unknown>;
  }
  const lastPart = parts.at(-1)!;
  if (!DANGEROUS_KEYS.has(lastPart)) current[lastPart] = value;
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
        const rawParsed: unknown = JSON.parse(raw);
        if (!isValidStorageFormat(rawParsed)) return;

        let parsed: StorageFormat = rawParsed;
        if (options.migrate && parsed.version !== version) {
          const migrated = options.migrate(parsed.data, parsed.version);
          if (!isPlainObject(migrated)) return;
          parsed = { version, data: migrated };
        }

        safeMerge(context.data as unknown as Record<string, unknown>, parsed.data);
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
