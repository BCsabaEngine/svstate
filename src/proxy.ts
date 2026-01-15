import { DeepProxy } from '@qiwi/deep-proxy';

export type ProxyChanged<T extends object> = (
  target: T,
  property: string,
  currentValue: unknown,
  oldValue: unknown
) => void;

export const ChangeProxy = <T extends object>(source: T, changed: ProxyChanged<T>): T => {
  const data = new DeepProxy(
    source,
    ({ trapName, name, path, target, receiver, value, newValue: recentValue, DEFAULT, PROXY }) => {
      switch (trapName) {
        case 'get':
          if (typeof value === 'object' && !(value instanceof Date) && value !== null) return PROXY;
          break;
        case 'set':
          if (Reflect.get(target, name, receiver) != recentValue) {
            Reflect.set(target, name, recentValue, receiver);

            path = path.filter((p) => !Number.isInteger(Number(p)));
            path.push(name as string);
            changed(data, path.join('.'), recentValue, value);
          }
          break;
      }
      return DEFAULT;
    }
  );
  return data;
};
