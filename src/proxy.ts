export type ProxyChanged<T extends object> = (
  target: T,
  property: string,
  currentValue: unknown,
  oldValue: unknown
) => void;

/** Reading this symbol off a change proxy yields the underlying raw object. */
const RAW = Symbol('svstate.raw');

/** Canonical array index (no leading zeros, no sign, no whitespace). */
const ARRAY_INDEX = /^(?:0|[1-9]\d*)$/;

const isProxiable = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  !(value instanceof Date) &&
  !(value instanceof Map) &&
  !(value instanceof Set) &&
  !(value instanceof WeakMap) &&
  !(value instanceof WeakSet) &&
  !(value instanceof RegExp) &&
  !(value instanceof Error) &&
  !(value instanceof Promise);

const unwrap = (value: unknown): unknown => {
  if (typeof value !== 'object' || value === null) return value;
  return (value as Record<symbol, unknown>)[RAW] ?? value;
};

// Array element and length writes are reported on the array itself; every other key —
// including numeric-looking keys on plain objects — keeps its own path segment.
const resolvePath = (object: object, property: string, parentPath: string): string => {
  if (Array.isArray(object) && (property === 'length' || ARRAY_INDEX.test(property))) return parentPath;
  return parentPath ? `${parentPath}.${property}` : property;
};

export const ChangeProxy = <T extends object>(source: T, changed: ProxyChanged<T>): T => {
  // raw object -> path -> proxy. The same object can be reachable through several paths, so the
  // path is part of the key. WeakRef values keep the cache from pinning raw objects in memory.
  const proxyCache = new WeakMap<object, Map<string, WeakRef<object>>>();

  const createProxy = (target: object, parentPath: string): object => {
    let byPath = proxyCache.get(target);
    if (byPath) {
      const cached = byPath.get(parentPath)?.deref();
      if (cached) return cached;
    } else {
      byPath = new Map();
      proxyCache.set(target, byPath);
    }

    const proxy = new Proxy(target, {
      get(object, property) {
        if (property === RAW) return object;
        if (typeof property === 'symbol') return (object as Record<symbol, unknown>)[property];
        const value = (object as Record<string, unknown>)[property];
        if (isProxiable(value)) return createProxy(value as object, resolvePath(object, property, parentPath));
        return value;
      },

      set(object, property, incomingValue) {
        if (typeof property === 'symbol') {
          (object as Record<symbol, unknown>)[property] = incomingValue;
          return true;
        }
        // Storing a proxy inside the raw tree would make later mutations report the path the
        // value was read from rather than the one it was written to.
        const nextValue = unwrap(incomingValue);
        const oldValue = (object as Record<string, unknown>)[property];
        if (Object.is(oldValue, nextValue)) return true;

        (object as Record<string, unknown>)[property] = nextValue;
        changed(data as T, resolvePath(object, property, parentPath), nextValue, oldValue);
        return true;
      },

      deleteProperty(object, property) {
        if (typeof property === 'symbol') return Reflect.deleteProperty(object, property);
        if (!Object.hasOwn(object, property)) return true;

        const oldValue = (object as Record<string, unknown>)[property];
        if (!Reflect.deleteProperty(object, property)) return false;

        changed(data as T, resolvePath(object, property, parentPath), undefined, oldValue);
        return true;
      }
    });

    byPath.set(parentPath, new WeakRef(proxy));
    return proxy;
  };

  const data = createProxy(source, '');
  return data as T;
};
