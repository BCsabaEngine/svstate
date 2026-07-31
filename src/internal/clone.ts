import { DANGEROUS_KEYS } from './paths';

// Values that cannot be meaningfully reconstructed by copying own keys.
// They are carried over by reference rather than being turned into broken look-alikes.
const isCarriedByReference = (value: object): boolean =>
  value instanceof Promise ||
  value instanceof WeakMap ||
  value instanceof WeakSet ||
  value instanceof WeakRef ||
  value instanceof Error ||
  value instanceof ArrayBuffer ||
  ArrayBuffer.isView(value);

/**
 * Structural clone that preserves prototypes (so methods on the state object keep working)
 * and reconstructs Map/Set/RegExp instead of producing empty look-alikes. Circular references
 * resolve to the already-cloned instance.
 */
export const deepClone = <T>(object: T, seen: WeakMap<object, unknown> = new WeakMap()): T => {
  if (object === null || typeof object !== 'object') return object;

  const reference = object as object;
  if (seen.has(reference)) return seen.get(reference) as T;

  if (object instanceof Date) return new Date(object) as T;
  if (object instanceof RegExp) {
    const clonedRegexp = new RegExp(object.source, object.flags);
    clonedRegexp.lastIndex = object.lastIndex;
    return clonedRegexp as T;
  }
  if (isCarriedByReference(reference)) return object;

  if (Array.isArray(object)) {
    const cloned: unknown[] = [];
    seen.set(reference, cloned);
    for (const item of object) cloned.push(deepClone(item, seen));
    return cloned as T;
  }

  if (object instanceof Map) {
    const cloned = new Map<unknown, unknown>();
    seen.set(reference, cloned);
    for (const [key, value] of object) cloned.set(deepClone(key, seen), deepClone(value, seen));
    return cloned as T;
  }

  if (object instanceof Set) {
    const cloned = new Set<unknown>();
    seen.set(reference, cloned);
    for (const value of object) cloned.add(deepClone(value, seen));
    return cloned as T;
  }

  const cloned = Object.create(Object.getPrototypeOf(reference)) as Record<string, unknown>;
  seen.set(reference, cloned);
  for (const [key, value] of Object.entries(reference)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    const descriptor = Object.getOwnPropertyDescriptor(reference, key);
    // Keep getters/setters as accessors rather than freezing them into a value
    if (descriptor && (descriptor.get || descriptor.set)) Object.defineProperty(cloned, key, descriptor);
    else cloned[key] = deepClone(value, seen);
  }
  return cloned as T;
};
