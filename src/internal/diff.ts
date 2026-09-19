// Structural comparison helpers used by the core to recompute dirty fields.
// Internal module — not part of the public API surface.

import { DANGEROUS_KEYS, isPlainObject } from './paths';

const isBranch = (value: unknown): value is Record<string, unknown> =>
  isPlainObject(value) &&
  !(value instanceof Date) &&
  !(value instanceof Map) &&
  !(value instanceof Set) &&
  !(value instanceof RegExp);

export const isDeepEqual = (a: unknown, b: unknown, seen = new WeakMap<object, object>()): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  // A pair already under comparison is assumed equal, which is what makes cycles terminate
  if (seen.get(a) === b) return true;
  seen.set(a, b);

  if (a instanceof Date || b instanceof Date)
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  if (a instanceof RegExp || b instanceof RegExp) return String(a) === String(b);
  if (a instanceof Map || b instanceof Map)
    return (
      a instanceof Map &&
      b instanceof Map &&
      a.size === b.size &&
      [...a].every(([key, value]) => b.has(key) && isDeepEqual(value, b.get(key), seen))
    );
  if (a instanceof Set || b instanceof Set)
    return (
      a instanceof Set &&
      b instanceof Set &&
      a.size === b.size &&
      [...a].every((item) => b.has(item) || [...b].some((other) => isDeepEqual(item, other, seen)))
    );
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a);
  return (
    keysA.length === Object.keys(b).length &&
    keysA.every(
      (key) =>
        Object.hasOwn(b, key) &&
        isDeepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], seen)
    )
  );
};

/**
 * Dot-notation paths at which `current` differs from `baseline`. Plain objects are walked;
 * arrays and other values are compared whole, matching how the proxy reports their changes.
 */
export const getChangedPaths = (
  current: Record<string, unknown>,
  baseline: Record<string, unknown>,
  prefix = '',
  visited = new WeakSet<object>()
): string[] => {
  visited.add(current);
  const paths: string[] = [];
  const keys = new Set([...Object.keys(current), ...Object.keys(baseline)]);
  for (const key of keys) {
    if (DANGEROUS_KEYS.has(key)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const value = current[key];
    const original = baseline[key];
    if (isBranch(value) && isBranch(original) && !visited.has(value))
      paths.push(...getChangedPaths(value, original, path, visited));
    else if (!isDeepEqual(value, original)) paths.push(path);
  }
  return paths;
};
