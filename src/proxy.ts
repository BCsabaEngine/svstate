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
      get(object, property, receiver) {
        const value = Reflect.get(object, property, receiver);
        if (isProxiable(value)) {
          const pathSegment = Number.isInteger(Number(property)) ? '' : String(property);
          const childPath = pathSegment ? (parentPath ? `${parentPath}.${pathSegment}` : pathSegment) : parentPath;
          return createProxy(value as object, childPath);
        }
        return value;
      },
      set(object, property, incomingValue, receiver) {
        const oldValue = Reflect.get(object, property, receiver);
        if (oldValue !== incomingValue) {
          Reflect.set(object, property, incomingValue, receiver);
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
