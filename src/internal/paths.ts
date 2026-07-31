// Shared path/merge helpers used by the core state and by plugins.
// Internal module — not part of the public API surface.

export const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Views a typed state object as an indexable record for path walking. */
export const asRecord = (value: object): Record<string, unknown> => value as Record<string, unknown>;

/**
 * Selects the registered dot-notation paths affected by a change at `changedPath`.
 * A path matches when it is the changed path itself, a descendant of it (changing
 * `user` affects `user.email`), or an ancestor of it (changing `user.email` affects `user`).
 */
export const getMatchingPaths = (registeredPaths: string[], changedPath: string): string[] =>
  registeredPaths.filter(
    (registeredPath) =>
      registeredPath === changedPath ||
      registeredPath.startsWith(changedPath + '.') ||
      changedPath.startsWith(registeredPath + '.')
  );

export const getValueAtPath = (source: unknown, path: string): unknown => {
  const parts = path.split('.');
  let current: unknown = source;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

export const setValueAtPath = (target: Record<string, unknown>, path: string, value: unknown): void => {
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

export const safeMerge = (target: Record<string, unknown>, source: Record<string, unknown>): void => {
  for (const [key, value] of Object.entries(source)) if (!DANGEROUS_KEYS.has(key)) target[key] = value;
};
