import { getChangedPaths, isDeepEqual } from '../src/internal/diff';
import { hasAnyErrors, toError } from '../src/internal/errors';
import { getMatchingPaths, getValueAtPath, safeDeepMerge, setValueAtPath } from '../src/internal/paths';
import { createDebouncer } from '../src/internal/timers';

describe('isDeepEqual', () => {
  it('compares primitives, NaN and null', () => {
    expect(isDeepEqual(1, 1)).toBe(true);
    expect(isDeepEqual(NaN, NaN)).toBe(true);
    expect(isDeepEqual(1, '1')).toBe(false);
    expect(isDeepEqual(undefined, undefined)).toBe(true);
    expect(isDeepEqual({}, undefined)).toBe(false);
  });

  it('compares plain objects and arrays structurally', () => {
    expect(isDeepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(isDeepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(isDeepEqual({ a: 1, b: 2 }, { a: 1, c: 2 })).toBe(false);
    expect(isDeepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(isDeepEqual([], {})).toBe(false);
  });

  it('compares Date and RegExp by value', () => {
    expect(isDeepEqual(new Date(5), new Date(5))).toBe(true);
    expect(isDeepEqual(new Date(5), new Date(6))).toBe(false);
    expect(isDeepEqual(new Date(5), {})).toBe(false);
    expect(isDeepEqual(/a/gi, /a/gi)).toBe(true);
    expect(isDeepEqual(/a/g, /a/i)).toBe(false);
  });

  it('compares Maps by size, keys and values', () => {
    expect(isDeepEqual(new Map([[1, { a: 1 }]]), new Map([[1, { a: 1 }]]))).toBe(true);
    expect(isDeepEqual(new Map([[1, 'a']]), new Map([[1, 'b']]))).toBe(false);
    expect(isDeepEqual(new Map([[1, 'a']]), new Map([[2, 'a']]))).toBe(false);
    expect(isDeepEqual(new Map([[1, 'a']]), new Map())).toBe(false);
    expect(isDeepEqual(new Map(), new Set())).toBe(false);
  });

  it('compares Sets including object members', () => {
    expect(isDeepEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true);
    expect(isDeepEqual(new Set([{ a: 1 }]), new Set([{ a: 1 }]))).toBe(true);
    expect(isDeepEqual(new Set([{ a: 1 }]), new Set([{ a: 2 }]))).toBe(false);
    expect(isDeepEqual(new Set([1]), new Set([1, 2]))).toBe(false);
    expect(isDeepEqual(new Set(), [])).toBe(false);
  });

  it('terminates on cyclic structures', () => {
    const a: Record<string, unknown> = { name: 'x' };
    a['self'] = a;
    const b: Record<string, unknown> = { name: 'x' };
    b['self'] = b;
    const c: Record<string, unknown> = { name: 'y' };
    c['self'] = c;

    expect(isDeepEqual(a, b)).toBe(true);
    expect(isDeepEqual(a, c)).toBe(false);
  });
});

describe('getChangedPaths', () => {
  it('reports nothing for equal trees', () => {
    expect(getChangedPaths({ a: 1, b: { c: [1, 2] } }, { a: 1, b: { c: [1, 2] } })).toEqual([]);
  });

  it('reports added, removed and changed keys at the deepest plain-object path', () => {
    const paths = getChangedPaths(
      { a: 1, b: { c: 2, d: { e: 3 } }, added: true },
      { a: 1, b: { c: 9, d: { e: 3 } }, removed: true }
    );

    expect(paths.toSorted((x, y) => x.localeCompare(y))).toEqual(['added', 'b.c', 'removed']);
  });

  it('compares arrays, Dates and Maps as a whole value', () => {
    expect(
      getChangedPaths(
        { list: [1, 2, 3], when: new Date(1), map: new Map([[1, 2]]) },
        {
          list: [1, 2],
          when: new Date(1),
          map: new Map([[1, 3]])
        }
      ).toSorted((x, y) => x.localeCompare(y))
    ).toEqual(['list', 'map']);
  });

  it('treats a plain object replaced by a primitive as one changed path', () => {
    expect(getChangedPaths({ a: 1 } as Record<string, unknown>, { a: { b: 1 } })).toEqual(['a']);
  });

  it('ignores dangerous keys and survives cycles', () => {
    const current: Record<string, unknown> = { a: 1 };
    current['self'] = current;
    const baseline: Record<string, unknown> = { a: 2 };
    baseline['self'] = baseline;

    // The cyclic back-reference is not walked again; it is compared whole and differs too
    expect(getChangedPaths(current, baseline)).toEqual(['a', 'self']);
    expect(getChangedPaths(JSON.parse('{"__proto__": {"x": 1}}') as Record<string, unknown>, {})).toEqual([]);
  });
});

describe('hasAnyErrors / toError', () => {
  it('finds errors inside nested objects and arrays', () => {
    expect(hasAnyErrors({ rows: [{ a: '' }, { a: 'bad' }] })).toBe(true);
    expect(hasAnyErrors({ rows: [{ a: '' }, { a: '' }] })).toBe(false);
    expect(hasAnyErrors({ rows: [] })).toBe(false);
    expect(hasAnyErrors({ list: ['', 'bad'] })).toBe(true);
    expect(hasAnyErrors({ a: { b: { c: 'deep' } } })).toBe(true);
    expect(hasAnyErrors(undefined)).toBe(false);
  });

  it('normalizes anything thrown into an Error', () => {
    const error = new Error('x');
    expect(toError(error)).toBe(error);
    expect(toError({ message: 'from message' }).message).toBe('from message');
    expect(toError({ body: { message: 'from body' } }).message).toBe('from body');
    expect(toError('boom').message).toBe('boom');
    expect(toError(42).message).toBe('42');
    expect(toError(undefined).message).toBe('undefined');
  });
});

describe('paths helpers', () => {
  it('getMatchingPaths matches exact, descendant and ancestor paths only', () => {
    const registered = ['user', 'user.email', 'users', 'items.1.name'];

    expect(getMatchingPaths(registered, 'user')).toEqual(['user', 'user.email']);
    expect(getMatchingPaths(registered, 'user.email')).toEqual(['user', 'user.email']);
    expect(getMatchingPaths(registered, 'user.email.domain')).toEqual(['user', 'user.email']);
    expect(getMatchingPaths(registered, 'items')).toEqual(['items.1.name']);
    expect(getMatchingPaths(registered, 'items.0.name')).toEqual([]);
    expect(getMatchingPaths(registered, 'use')).toEqual([]);
  });

  it('getValueAtPath walks arrays and stops at nullish values', () => {
    const source = { items: [{ name: 'a' }, { name: 'b' }], gone: undefined };

    expect(getValueAtPath(source, 'items.1.name')).toBe('b');
    expect(getValueAtPath(source, 'gone.deeper')).toBeUndefined();
    expect(getValueAtPath(source, 'missing.deeper')).toBeUndefined();
  });

  it('setValueAtPath creates intermediates and refuses dangerous keys', () => {
    const target: Record<string, unknown> = {};

    setValueAtPath(target, 'a.b.c', 1);
    setValueAtPath(target, '__proto__.polluted', true);
    setValueAtPath(target, 'a.constructor', true);

    expect(target).toEqual({ a: { b: { c: 1 } } });
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('safeDeepMerge merges plain objects, replaces arrays/Dates and skips dangerous keys', () => {
    const date = new Date(1);
    const target: Record<string, unknown> = { a: { keep: 1, over: 1 }, list: [1, 2], when: new Date(0), plain: 1 };

    safeDeepMerge(target, {
      a: { over: 2, added: 3 },
      list: [9],
      when: date,
      plain: { now: 'object' },
      ...(JSON.parse('{"__proto__": {"polluted": true}}') as Record<string, unknown>)
    });

    expect(target).toEqual({ a: { keep: 1, over: 2, added: 3 }, list: [9], when: date, plain: { now: 'object' } });
    expect(target['when']).toBe(date);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('createDebouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('collapses a burst into one run and reports pending state', () => {
    const run = vi.fn();
    const debouncer = createDebouncer(run, 100);

    expect(debouncer.isPending()).toBe(false);
    debouncer.schedule();
    vi.advanceTimersByTime(60);
    debouncer.schedule();
    expect(debouncer.isPending()).toBe(true);

    vi.advanceTimersByTime(99);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(debouncer.isPending()).toBe(false);
  });

  it('cancel drops a pending run and flush runs it immediately, once', () => {
    const run = vi.fn();
    const debouncer = createDebouncer(run, 100);

    debouncer.schedule();
    debouncer.cancel();
    vi.advanceTimersByTime(200);
    expect(run).not.toHaveBeenCalled();

    debouncer.flush(); // nothing pending
    expect(run).not.toHaveBeenCalled();

    debouncer.schedule();
    debouncer.flush();
    debouncer.flush();
    vi.advanceTimersByTime(200);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
