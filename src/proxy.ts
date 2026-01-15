import { DeepProxy } from '@qiwi/deep-proxy';

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
  const data = new DeepProxy(
    source,
    ({ trapName, name, path, target, receiver, value, newValue: recentValue, DEFAULT, PROXY }) => {
      switch (trapName) {
        case 'get':
          if (isProxiable(value)) return PROXY;
          break;
        case 'set': {
          const currentValue = Reflect.get(target, name, receiver);
          if (currentValue !== recentValue) {
            Reflect.set(target, name, recentValue, receiver);

            let propertyPath = '';
            for (const p of path)
              if (!Number.isInteger(Number(p))) {
                if (propertyPath) propertyPath += '.';
                propertyPath += p;
              }
            if (propertyPath) propertyPath += '.';
            propertyPath += String(name);

            changed(data, propertyPath, recentValue, currentValue);
          }
          break;
        }
      }
      return DEFAULT;
    }
  );
  return data;
};
