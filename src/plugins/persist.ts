import { asRecord, getValueAtPath, isPlainObject, safeMerge, setValueAtPath } from '../internal/paths';
import { createDebouncer } from '../internal/timers';
import type { SvStatePlugin } from '../plugin';

const isValidStorageFormat = (value: unknown): value is StorageFormat =>
  isPlainObject(value) &&
  typeof (value as StorageFormat).version === 'number' &&
  isPlainObject((value as StorageFormat).data);

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
  onError?: (error: unknown) => void;
};

type StorageFormat = {
  version: number;
  data: Record<string, unknown>;
};

const excludePath = (filtered: Record<string, unknown>, path: string): void => {
  const parts = path.split('.');
  if (parts.length === 1) {
    delete filtered[path];
    return;
  }
  let current: Record<string, unknown> = filtered;
  for (let index = 0; index < parts.length - 1; index++) {
    const part = parts[index]!;
    if (current[part] === undefined) return;
    if (index === parts.length - 2) {
      const parent = current[part] as Record<string, unknown>;
      current[part] = { ...parent };
      delete (current[part] as Record<string, unknown>)[parts.at(-1)!];
    } else {
      current[part] = { ...(current[part] as Record<string, unknown>) };
      current = current[part] as Record<string, unknown>;
    }
  }
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
    for (const path of exclude) excludePath(filtered, path);
    return filtered;
  }
  return data;
};

export type PersistPluginInstance<T extends Record<string, unknown>> = SvStatePlugin<T> & {
  clearPersistedState(): void;
  isRestored(): boolean;
};

export function persistPlugin<T extends Record<string, unknown>>(options: PersistOptions): PersistPluginInstance<T> {
  const storage = options.storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
  const throttleMs = options.throttle ?? 300;
  const version = options.version ?? 1;

  let isRestored = false;
  let contextData: T | undefined;

  const writeToStorage = () => {
    if (!storage || !contextData) return;
    try {
      const filtered = filterData(asRecord(contextData), options.include, options.exclude);
      const payload: StorageFormat = { version, data: filtered };
      storage.setItem(options.key, JSON.stringify(payload));
    } catch (error) {
      // Quota exceeded, unserializable state, blocked storage — never throw out of a timer
      options.onError?.(error);
    }
  };

  const writer = createDebouncer(writeToStorage, throttleMs);

  const plugin: PersistPluginInstance<T> = {
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

        safeMerge(asRecord(context.data), parsed.data);
        isRestored = true;
      } catch {
        // Invalid stored data — ignore
      }
    },

    onChange() {
      writer.schedule();
    },

    onReset() {
      writeToStorage();
    },

    // Idempotent: only a still-pending write is flushed, so a second destroy() is a no-op
    destroy() {
      writer.flush();
    },

    clearPersistedState() {
      storage?.removeItem(options.key);
    },

    isRestored() {
      return isRestored;
    }
  };

  return plugin;
}
