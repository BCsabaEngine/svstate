import { ChangeProxy, type ProxyChanged } from '../src/proxy';

describe('ChangeProxy', () => {
  describe('basic property access', () => {
    it('should get property values', () => {
      const source = { name: 'test', count: 5 };
      const proxy = ChangeProxy(source, vi.fn());

      expect(proxy.name).toBe('test');
      expect(proxy.count).toBe(5);
    });

    it('should set property values', () => {
      const source = { name: 'test' };
      const proxy = ChangeProxy(source, vi.fn());

      proxy.name = 'updated';
      expect(proxy.name).toBe('updated');
    });
  });

  describe('change callback', () => {
    it('should call callback when property changes', () => {
      const source = { name: 'test' };
      const changed = vi.fn();
      const proxy = ChangeProxy(source, changed);

      proxy.name = 'updated';

      expect(changed).toHaveBeenCalledTimes(1);
      expect(changed).toHaveBeenCalledWith(expect.any(Object), 'name', 'updated', 'test');
    });

    it('should not call callback when value is the same', () => {
      const source = { name: 'test' };
      const changed = vi.fn();
      const proxy = ChangeProxy(source, changed);

      proxy.name = 'test';

      expect(changed).not.toHaveBeenCalled();
    });

    it('should pass the proxy as target in callback', () => {
      const source = { name: 'test' };
      let receivedTarget: unknown;
      const changed: ProxyChanged<typeof source> = (target) => {
        receivedTarget = target;
      };
      const proxy = ChangeProxy(source, changed);

      proxy.name = 'updated';

      expect(receivedTarget).toBe(proxy);
    });
  });

  describe('nested objects', () => {
    it('should get nested property values', () => {
      const source = { user: { name: 'test', age: 25 } };
      const proxy = ChangeProxy(source, vi.fn());

      expect(proxy.user.name).toBe('test');
      expect(proxy.user.age).toBe(25);
    });

    it('should set nested property values', () => {
      const source = { user: { name: 'test' } };
      const proxy = ChangeProxy(source, vi.fn());

      proxy.user.name = 'updated';

      expect(proxy.user.name).toBe('updated');
    });

    it('should call callback with dot notation path for nested changes', () => {
      const source = { user: { name: 'test' } };
      const changed = vi.fn();
      const proxy = ChangeProxy(source, changed);

      proxy.user.name = 'updated';

      expect(changed).toHaveBeenCalledWith(expect.any(Object), 'user.name', 'updated', 'test');
    });

    it('should handle deeply nested objects', () => {
      const source = { level1: { level2: { level3: { value: 'deep' } } } };
      const changed = vi.fn();
      const proxy = ChangeProxy(source, changed);

      proxy.level1.level2.level3.value = 'updated';

      expect(changed).toHaveBeenCalledWith(expect.any(Object), 'level1.level2.level3.value', 'updated', 'deep');
    });

    it('should handle replacing entire nested object', () => {
      const source = { user: { name: 'test' } };
      const changed = vi.fn();
      const proxy = ChangeProxy(source, changed);

      proxy.user = { name: 'new user' };

      expect(changed).toHaveBeenCalledWith(expect.any(Object), 'user', { name: 'new user' }, { name: 'test' });
    });
  });

  describe('arrays', () => {
    it('should get array values', () => {
      const source = { items: [1, 2, 3] };
      const proxy = ChangeProxy(source, vi.fn());

      expect(proxy.items[0]).toBe(1);
      expect(proxy.items[1]).toBe(2);
      expect(proxy.items.length).toBe(3);
    });

    it('should set array values', () => {
      const source = { items: [1, 2, 3] };
      const proxy = ChangeProxy(source, vi.fn());

      proxy.items[0] = 10;

      expect(proxy.items[0]).toBe(10);
    });

    it('should collapse array indices in path', () => {
      const source = { items: [1, 2, 3] };
      const changed = vi.fn();
      const proxy = ChangeProxy(source, changed);

      proxy.items[0] = 10;

      expect(changed).toHaveBeenCalledWith(expect.any(Object), 'items', 10, 1);
    });

    it('should handle nested objects inside arrays', () => {
      const source = { users: [{ name: 'Alice' }, { name: 'Bob' }] };
      const changed = vi.fn();
      const proxy = ChangeProxy(source, changed);

      proxy.users[0].name = 'Updated';

      expect(changed).toHaveBeenCalledWith(expect.any(Object), 'users.name', 'Updated', 'Alice');
    });

    it('should handle push operations', () => {
      const source = { items: [1, 2] };
      const changed = vi.fn();
      const proxy = ChangeProxy(source, changed);

      proxy.items.push(3);

      expect(proxy.items).toEqual([1, 2, 3]);
      expect(changed).toHaveBeenCalled();
    });

    it('should handle nested arrays', () => {
      const source = {
        matrix: [
          [1, 2],
          [3, 4]
        ]
      };
      const changed = vi.fn();
      const proxy = ChangeProxy(source, changed);

      proxy.matrix[0][0] = 10;

      expect(proxy.matrix[0][0]).toBe(10);
      expect(changed).toHaveBeenCalledWith(expect.any(Object), 'matrix', 10, 1);
    });
  });

  describe('non-proxiable types', () => {
    it('should return Date as-is without proxying', () => {
      const date = new Date('2024-01-01');
      const source = { created: date };
      const proxy = ChangeProxy(source, vi.fn());

      expect(proxy.created).toBe(date);
      expect(proxy.created instanceof Date).toBe(true);
    });

    it('should return Map as-is without proxying', () => {
      const map = new Map([['key', 'value']]);
      const source = { data: map };
      const proxy = ChangeProxy(source, vi.fn());

      expect(proxy.data).toBe(map);
      expect(proxy.data instanceof Map).toBe(true);
    });

    it('should return Set as-is without proxying', () => {
      const set = new Set([1, 2, 3]);
      const source = { items: set };
      const proxy = ChangeProxy(source, vi.fn());

      expect(proxy.items).toBe(set);
      expect(proxy.items instanceof Set).toBe(true);
    });

    it('should return WeakMap as-is without proxying', () => {
      const weakMap = new WeakMap();
      const source = { data: weakMap };
      const proxy = ChangeProxy(source, vi.fn());

      expect(proxy.data).toBe(weakMap);
      expect(proxy.data instanceof WeakMap).toBe(true);
    });

    it('should return WeakSet as-is without proxying', () => {
      const weakSet = new WeakSet();
      const source = { items: weakSet };
      const proxy = ChangeProxy(source, vi.fn());

      expect(proxy.items).toBe(weakSet);
      expect(proxy.items instanceof WeakSet).toBe(true);
    });

    it('should return RegExp as-is without proxying', () => {
      const regexp = /test/gi;
      const source = { pattern: regexp };
      const proxy = ChangeProxy(source, vi.fn());

      expect(proxy.pattern).toBe(regexp);
      expect(proxy.pattern instanceof RegExp).toBe(true);
    });

    it('should return Error as-is without proxying', () => {
      const error = new Error('test error');
      const source = { error };
      const proxy = ChangeProxy(source, vi.fn());

      expect(proxy.error).toBe(error);
      expect(proxy.error instanceof Error).toBe(true);
    });

    it('should return Promise as-is without proxying', () => {
      const promise = Promise.resolve('test');
      const source = { result: promise };
      const proxy = ChangeProxy(source, vi.fn());

      expect(proxy.result).toBe(promise);
      expect(proxy.result instanceof Promise).toBe(true);
    });

    it('should return null as-is', () => {
      // eslint-disable-next-line unicorn/no-null -- testing null handling
      const source = { value: null as null | string };
      const proxy = ChangeProxy(source, vi.fn());

      expect(proxy.value).toBeNull();
    });

    it('should return primitive values as-is', () => {
      const source = { str: 'test', num: 42, bool: true, undef: undefined };
      const proxy = ChangeProxy(source, vi.fn());

      expect(proxy.str).toBe('test');
      expect(proxy.num).toBe(42);
      expect(proxy.bool).toBe(true);
      expect(proxy.undef).toBeUndefined();
    });
  });

  describe('strict equality check', () => {
    it('should not trigger callback for same primitive value', () => {
      const source = { count: 5 };
      const changed = vi.fn();
      const proxy = ChangeProxy(source, changed);

      proxy.count = 5;

      expect(changed).not.toHaveBeenCalled();
    });

    it('should trigger callback for different object reference even with same content', () => {
      const source = { user: { name: 'test' } };
      const changed = vi.fn();
      const proxy = ChangeProxy(source, changed);

      proxy.user = { name: 'test' };

      expect(changed).toHaveBeenCalledTimes(1);
    });

    it('should not trigger callback for same object reference', () => {
      const user = { name: 'test' };
      const source = { user };
      const changed = vi.fn();
      const proxy = ChangeProxy(source, changed);

      proxy.user = user;

      expect(changed).not.toHaveBeenCalled();
    });

    it('should trigger callback when changing from value to undefined', () => {
      const source = { value: 'test' as string | undefined };
      const changed = vi.fn();
      const proxy = ChangeProxy(source, changed);

      proxy.value = undefined;

      expect(changed).toHaveBeenCalledWith(expect.any(Object), 'value', undefined, 'test');
    });

    it('should trigger callback when changing from undefined to value', () => {
      const source = { value: undefined as string | undefined };
      const changed = vi.fn();
      const proxy = ChangeProxy(source, changed);

      proxy.value = 'test';

      expect(changed).toHaveBeenCalledWith(expect.any(Object), 'value', 'test', undefined);
    });
  });

  describe('edge cases', () => {
    it('should handle empty object', () => {
      const source = {} as Record<string, unknown>;
      const changed = vi.fn();
      const proxy = ChangeProxy(source, changed);

      proxy.addedProp = 'value';

      expect(changed).toHaveBeenCalledWith(expect.any(Object), 'addedProp', 'value', undefined);
    });

    it('should handle multiple rapid changes', () => {
      const source = { count: 0 };
      const changed = vi.fn();
      const proxy = ChangeProxy(source, changed);

      proxy.count = 1;
      proxy.count = 2;
      proxy.count = 3;

      expect(changed).toHaveBeenCalledTimes(3);
    });

    it('should handle changes to different properties', () => {
      const source = { a: 1, b: 2 };
      const changed = vi.fn();
      const proxy = ChangeProxy(source, changed);

      proxy.a = 10;
      proxy.b = 20;

      expect(changed).toHaveBeenCalledTimes(2);
      expect(changed).toHaveBeenNthCalledWith(1, expect.any(Object), 'a', 10, 1);
      expect(changed).toHaveBeenNthCalledWith(2, expect.any(Object), 'b', 20, 2);
    });

    it('should return true from set trap even when value unchanged', () => {
      const source = { value: 'test' };
      const proxy = ChangeProxy(source, vi.fn());

      const result = Reflect.set(proxy, 'value', 'test');

      expect(result).toBe(true);
    });

    it('should handle symbol properties in path segments', () => {
      const source = { '123abc': 'test' };
      const changed = vi.fn();
      const proxy = ChangeProxy(source, changed);

      proxy['123abc'] = 'updated';

      expect(changed).toHaveBeenCalledWith(expect.any(Object), '123abc', 'updated', 'test');
    });
  });
});
