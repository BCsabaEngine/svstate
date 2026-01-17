export type ProxyChanged<T extends object> = (
  target: T,
  property: string,
  currentValue: unknown,
  oldValue: unknown
) => void;

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

export const ChangeProxy = <T extends object>(source: T, changed: ProxyChanged<T>): T => {
  const createProxy = (target: object, parentPath: string): object =>
    new Proxy(target, {
      get(object, property) {
        const value = (object as Record<string, unknown>)[property as string];
        if (isProxiable(value)) {
          const pathSegment = Number.isInteger(Number(property)) ? '' : String(property);
          const childPath = pathSegment ? (parentPath ? `${parentPath}.${pathSegment}` : pathSegment) : parentPath;
          return createProxy(value as object, childPath);
        }
        return value;
      },
      set(object, property, incomingValue) {
        const oldValue = (object as Record<string, unknown>)[property as string];
        if (oldValue !== incomingValue) {
          (object as Record<string, unknown>)[property as string] = incomingValue;
          const pathSegment = Number.isInteger(Number(property)) ? '' : String(property);
          const fullPath = pathSegment ? (parentPath ? `${parentPath}.${pathSegment}` : pathSegment) : parentPath;
          changed(data as T, fullPath, incomingValue, oldValue);
        }
        return true;
      }
    });

  const data = createProxy(source, '');
  return data as T;
};
