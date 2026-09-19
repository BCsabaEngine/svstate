import { get } from 'svelte/store';

import { arrayValidator, createSvState, dateValidator, numberValidator, stringValidator } from '../src/index';
import { deepClone } from '../src/internal/clone';
import { getChangedPaths } from '../src/internal/diff';
import { analyticsPlugin } from '../src/plugins/analytics';
import { autosavePlugin } from '../src/plugins/autosave';
import { historyPlugin } from '../src/plugins/history';
import { persistPlugin } from '../src/plugins/persist';
import { syncPlugin } from '../src/plugins/sync';
import { undoRedoPlugin } from '../src/plugins/undo-redo';
import { ChangeProxy } from '../src/proxy';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createMockStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? (undefined as unknown as null),
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key)
  };
};

describe('async validation - superseded run cleanup', () => {
  it('keeps the newer run tracked after the cancelled one settles', async () => {
    let calls = 0;
    const { data, state } = createSvState(
      { name: '' },
      {
        // Ignores the abort signal on purpose: the old run settles late and must not touch the new one
        asyncValidator: {
          name: async () => {
            calls++;
            await sleep(calls === 1 ? 60 : 200);
            return '';
          }
        }
      },
      { debounceAsyncValidation: 20 }
    );

    data.name = 'a';
    await sleep(30); // first run is in flight
    data.name = 'b'; // aborts it and schedules the second
    await sleep(110); // the first has settled, the second is still running

    expect(calls).toBe(2);
    expect(get(state.asyncValidating)).toEqual(['name']);
    await sleep(200);
    expect(get(state.asyncValidating)).toEqual([]);
  });

  it('a later change still cancels the pending debounce after the old run settled', async () => {
    let calls = 0;
    const { data } = createSvState(
      { name: '' },
      {
        asyncValidator: {
          name: async () => {
            calls++;
            await sleep(40);
            return '';
          }
        }
      },
      { debounceAsyncValidation: 100 }
    );

    data.name = 'a';
    await sleep(120); // first run in flight
    data.name = 'b'; // cancels it, debounce for the second starts
    await sleep(60); // old run settles inside the debounce window
    data.name = 'c'; // must replace the pending debounce, not add another one
    await sleep(400);

    expect(calls).toBe(2);
  });
});

describe('execute', () => {
  it('calls actionCompleted once and reports its failure when the action succeeded', async () => {
    const completed = vi.fn(() => {
      throw new Error('completed failed');
    });
    const { execute, state } = createSvState({ a: 1 }, { action: () => {}, actionCompleted: completed });

    await execute();

    expect(completed).toHaveBeenCalledTimes(1);
    expect(get(state.actionError)?.message).toBe('completed failed');
    expect(get(state.actionInProgress)).toBe(false);
  });

  it('keeps the original error when actionCompleted throws as well', async () => {
    const { execute, state } = createSvState(
      { a: 1 },
      {
        action: () => {
          throw new Error('action failed');
        },
        actionCompleted: () => {
          throw new Error('completed failed');
        }
      }
    );

    await expect(execute()).resolves.toBeUndefined();

    expect(get(state.actionError)?.message).toBe('action failed');
    expect(get(state.actionInProgress)).toBe(false);
  });

  it('stays in progress until every concurrent action has finished', async () => {
    const { execute, state } = createSvState(
      { a: 1 },
      { action: (parameters?: { ms: number }) => sleep(parameters?.ms ?? 0) },
      { allowConcurrentActions: true }
    );

    const fast = execute({ ms: 10 });
    const slow = execute({ ms: 80 });
    await fast;

    expect(get(state.actionInProgress)).toBe(true);
    await slow;
    expect(get(state.actionInProgress)).toBe(false);
  });
});

describe('effect failures', () => {
  it('still validates and notifies plugins when the effect throws', async () => {
    const changes: string[] = [];
    const { data, state } = createSvState(
      { name: '' },
      {
        validator: (source) => ({ name: stringValidator(source.name).required().getError() }),
        effect: () => {
          throw new Error('effect failed');
        }
      },
      { plugins: [{ name: 'spy', onChange: (event) => void changes.push(event.property) }] }
    );

    expect(() => (data.name = 'x')).toThrow('effect failed');
    await Promise.resolve();

    expect(changes).toEqual(['name']);
    expect(get(state.errors)).toEqual({ name: '' });
    expect(get(state.isDirty)).toBe(true);
  });
});

describe('rollback', () => {
  it('leaves fields that still differ from the initial state dirty', () => {
    const { data, rollback, reset, state } = createSvState(
      { a: 0, b: 0 },
      { effect: ({ snapshot, property }) => snapshot(`Changed ${property}`) }
    );

    data.a = 1;
    data.b = 1;
    rollback();

    expect(data.b).toBe(0);
    expect(get(state.isDirty)).toBe(true);
    expect(get(state.isDirtyByField)).toEqual({ a: true });

    reset();
    expect(get(state.isDirty)).toBe(false);
  });

  it('re-validates async validators for values that still differ from the initial state', async () => {
    const { data, rollback, state } = createSvState(
      { username: '' },
      {
        effect: ({ snapshot, currentValue }) => snapshot(`v:${String(currentValue)}`),
        asyncValidator: { username: async (value) => (value === 'taken' ? 'Username taken' : '') }
      },
      { debounceAsyncValidation: 10 }
    );

    data.username = 'taken';
    data.username = 'other';
    rollback();
    await sleep(60);

    expect(data.username).toBe('taken');
    expect(get(state.asyncErrors)).toEqual({ username: 'Username taken' });
  });

  it('never replaces the Initial snapshot', () => {
    const { data, state } = createSvState({ a: 0 }, { effect: ({ snapshot }) => snapshot('Initial') });

    data.a = 1;

    expect(get(state.snapshots).length).toBe(2);
    expect(get(state.snapshots)[0]!.data).toEqual({ a: 0 });
  });
});

describe('batch snapshots', () => {
  it('honours shouldReplace of the first snapshot request', () => {
    const { data, batch, state } = createSvState({ a: 0, b: 0 }, { effect: ({ snapshot }) => snapshot('edit') });

    data.a = 1;
    batch((draft) => {
      draft.a = 2;
      draft.b = 2;
    });

    expect(get(state.snapshots).map((s) => s.title)).toEqual(['Initial', 'edit']);
  });
});

describe('plugin startup', () => {
  it('reports the first validation only after onInit ran', () => {
    const order: string[] = [];
    createSvState(
      { a: '' },
      { validator: () => ({ a: '' }) },
      {
        plugins: [
          {
            name: 'spy',
            onInit: () => void order.push('init'),
            onValidation: () => void order.push('validation')
          }
        ]
      }
    );

    expect(order).toEqual(['init', 'validation']);
  });
});

describe('proxy', () => {
  it('creates the key when undefined is written to a missing one', () => {
    const changes: string[] = [];
    const { data } = createSvState({} as { a?: number }, undefined, {
      plugins: [{ name: 'spy', onChange: (event) => void changes.push(event.property) }]
    });

    data.a = undefined;

    expect(Object.hasOwn(data, 'a')).toBe(true);
    expect(changes).toEqual(['a']);
    data.a = undefined;
    expect(changes).toEqual(['a']);
  });
});

describe('internal helpers', () => {
  it('keeps a Date shared by two places shared in the clone', () => {
    const shared = new Date(0);
    const cloned = deepClone({ a: shared, b: shared });

    expect(cloned.a).not.toBe(shared);
    expect(cloned.a).toBe(cloned.b);
  });

  it('reports the differing leaf paths', () => {
    expect(
      getChangedPaths(
        { a: 1, nested: { x: 1, y: [1, 2] }, d: new Date(1), gone: 1 },
        { a: 1, nested: { x: 2, y: [1, 2] }, d: new Date(1) }
      ).toSorted((a, b) => a.localeCompare(b))
    ).toEqual(['gone', 'nested.x']);
  });
});

describe('validators', () => {
  it('reads the weekday of a date-only string in UTC regardless of the local zone', () => {
    const previous = process.env['TZ'];
    process.env['TZ'] = 'America/Los_Angeles';
    try {
      expect(dateValidator('2024-01-15').weekday().getError()).toBe('');
      expect(dateValidator('2024-01-15').weekend().getError()).toBe('Must be a weekend');
      expect(dateValidator('2024-01-14').weekend().getError()).toBe('');
    } finally {
      if (previous === undefined) delete process.env['TZ'];
      else process.env['TZ'] = previous;
    }
  });

  it('regexp() gives the same answer on every call for a global regexp', () => {
    const pattern = /^a+$/g;

    for (let index = 0; index < 4; index++) expect(stringValidator('aaa').regexp(pattern).getError()).toBe('');
  });

  it('multipleOf() does not accept everything for a tiny divisor', () => {
    expect(numberValidator(1.5e-12).multipleOf(1e-12).getError()).toBe('Must be a multiple of 1e-12');
    expect(numberValidator(0.3).multipleOf(0.1).getError()).toBe('');
  });

  it('unique() tells Sets, Maps and nested NaN/null apart', () => {
    expect(
      arrayValidator([new Set([1]), new Set([2])])
        .unique()
        .getError()
    ).toBe('');
    expect(
      arrayValidator([new Set([1]), new Set([1])])
        .unique()
        .getError()
    ).toBe('Items must be unique');
    expect(
      arrayValidator([new Map([[1, 'a']]), new Map([[1, 'b']])])
        .unique()
        .getError()
    ).toBe('');
    expect(
      arrayValidator([{ a: NaN }, { a: undefined }])
        .unique()
        .getError()
    ).toBe('');
  });
});

describe('historyPlugin', () => {
  const mockUrl = { search: '', href: 'http://localhost/' };
  const pushed: string[] = [];
  const replaced: string[] = [];
  const popstateListeners: (() => void)[] = [];

  const setUrl = (url: string) => {
    mockUrl.href = url;
    mockUrl.search = new URL(url).search;
  };

  beforeEach(() => {
    setUrl('http://localhost/');
    pushed.length = 0;
    replaced.length = 0;
    popstateListeners.length = 0;
    Object.defineProperty(globalThis, 'window', {
      value: {
        location: {
          get search() {
            return mockUrl.search;
          },
          get href() {
            return mockUrl.href;
          }
        },
        history: {
          pushState: (_state: unknown, _title: string, url: string) => {
            pushed.push(url);
            setUrl(url);
          },
          replaceState: (_state: unknown, _title: string, url: string) => {
            replaced.push(url);
            setUrl(url);
          }
        },
        addEventListener: (_event: string, handler: () => void) => void popstateListeners.push(handler),
        removeEventListener: () => {}
      },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
  });

  it('does not push history entries while applying the URL (push mode)', () => {
    setUrl('http://localhost/?q=hello');
    const { data } = createSvState({ query: '' }, undefined, {
      plugins: [historyPlugin({ fields: { query: 'q' }, mode: 'push' })]
    });

    expect(data.query).toBe('hello');
    expect(pushed).toEqual([]);

    setUrl('http://localhost/?q=back');
    for (const listener of popstateListeners) listener();

    expect(data.query).toBe('back');
    expect(pushed).toEqual([]);
  });

  it('restores the default when the param disappears from the URL', () => {
    const { data } = createSvState({ query: 'default' }, undefined, {
      plugins: [historyPlugin({ fields: { query: 'q' } })]
    });

    setUrl('http://localhost/?q=abc');
    for (const listener of popstateListeners) listener();
    expect(data.query).toBe('abc');

    setUrl('http://localhost/');
    for (const listener of popstateListeners) listener();
    expect(data.query).toBe('default');
  });

  it('writes the restored state back to the URL on reset and rollback', () => {
    const { data, reset, rollback } = createSvState(
      { query: '' },
      { effect: ({ snapshot, currentValue }) => snapshot(`q:${String(currentValue)}`) },
      { plugins: [historyPlugin({ fields: { query: 'q' } })] }
    );

    data.query = 'a';
    data.query = 'b';
    rollback();
    expect(mockUrl.search).toBe('?q=a');

    reset();
    expect(mockUrl.search).toBe('');
  });
});

describe('analyticsPlugin redaction', () => {
  it('masks redacted paths inside a value assigned to their parent', () => {
    const flushed: Record<string, unknown>[] = [];
    const analytics = analyticsPlugin({
      onFlush: (events) => void flushed.push(...events.map((event) => event.detail)),
      redact: ['user.ssn'],
      include: ['change'],
      flushInterval: 0
    });
    const { data } = createSvState({ user: { name: 'a', ssn: '111' } }, undefined, { plugins: [analytics] });

    data.user = { name: 'b', ssn: '222' };
    analytics.flush();

    expect(flushed[0]).toEqual({
      property: 'user',
      currentValue: { name: 'b', ssn: '[redacted]' },
      oldValue: { name: 'a', ssn: '[redacted]' }
    });
    expect(data.user.ssn).toBe('222');
  });
});

describe('autosavePlugin', () => {
  it('does not re-save unchanged data on every interval tick', async () => {
    let saves = 0;
    const autosave = autosavePlugin({ save: () => void saves++, idle: 1000, interval: 20 });
    const { data, destroy } = createSvState({ name: '' }, undefined, { plugins: [autosave] });

    data.name = 'x';
    await sleep(150);
    destroy();

    expect(saves).toBe(1);
  });

  it('saves the restored state after a rollback although dirty was cleared', async () => {
    const saved: string[] = [];
    const autosave = autosavePlugin<{ name: string }>({ save: (data) => void saved.push(data.name), idle: 20 });
    const { data, rollback, state } = createSvState(
      { name: 'initial' },
      { effect: ({ snapshot }) => snapshot('edit') },
      { plugins: [autosave] }
    );

    data.name = 'edited';
    await sleep(60);
    rollback();
    expect(get(state.isDirty)).toBe(false);
    await sleep(60);

    expect(saved).toEqual(['edited', 'initial']);
  });
});

describe('persistPlugin', () => {
  it('writes the rolled-back state to storage', () => {
    const storage = createMockStorage();
    const { data, rollback } = createSvState(
      { name: 'initial' },
      { effect: ({ snapshot }) => snapshot('edit') },
      { plugins: [persistPlugin({ key: 'k', storage })] }
    );

    data.name = 'edited';
    rollback();

    expect(JSON.parse(storage.getItem('k')!).data.name).toBe('initial');
  });

  it('ignores data stored under another version when there is no migrate', () => {
    const storage = createMockStorage();
    storage.setItem('k', JSON.stringify({ version: 1, data: { name: 'old' } }));
    const persist = persistPlugin({ key: 'k', storage, version: 2 });
    const { data } = createSvState({ name: 'initial' }, undefined, { plugins: [persist] });

    expect(data.name).toBe('initial');
    expect(persist.isRestored()).toBe(false);
  });

  it('keeps nested defaults the stored data does not know about', () => {
    const storage = createMockStorage();
    storage.setItem('k', JSON.stringify({ version: 1, data: { settings: { theme: 'dark' } } }));
    const { data } = createSvState({ settings: { theme: 'light', lang: 'hu' } }, undefined, {
      plugins: [persistPlugin({ key: 'k', storage })]
    });

    expect(data.settings).toEqual({ theme: 'dark', lang: 'hu' });
  });

  it('applies include/exclude when reading back too', () => {
    const storage = createMockStorage();
    storage.setItem('k', JSON.stringify({ version: 1, data: { name: 'stored', secret: 'leaked' } }));
    const { data } = createSvState({ name: 'initial', secret: 'own' }, undefined, {
      plugins: [persistPlugin({ key: 'k', storage, exclude: ['secret'] })]
    });

    expect(data.name).toBe('stored');
    expect(data.secret).toBe('own');
  });
});

describe('undoRedoPlugin', () => {
  it('does not queue a redo entry for a rollback that removes nothing', () => {
    const undoRedo = undoRedoPlugin<{ name: string }>();
    const { data, reset, rollbackTo } = createSvState(
      { name: 'initial' },
      { effect: ({ snapshot, currentValue }) => snapshot(`n:${String(currentValue)}`) },
      { plugins: [undoRedo] }
    );

    data.name = 'a';
    data.name = 'b';
    reset(); // shrinks the snapshot list, which must not leave a stale redo candidate behind
    data.name = 'c';
    rollbackTo('n:c');

    expect(undoRedo.canRedo()).toBe(false);
  });
});

describe('syncPlugin', () => {
  class MockBroadcastChannel {
    static channels = new Map<string, MockBroadcastChannel[]>();
    private listeners: ((event: MessageEvent) => void)[] = [];

    constructor(public name: string) {
      MockBroadcastChannel.channels.set(name, [...(MockBroadcastChannel.channels.get(name) ?? []), this]);
    }

    addEventListener(_type: string, handler: (event: MessageEvent) => void) {
      this.listeners.push(handler);
    }

    postMessage(data: unknown) {
      const channels = MockBroadcastChannel.channels.get(this.name) ?? [];
      for (const channel of channels)
        if (channel !== this) for (const listener of channel.listeners) listener(new MessageEvent('message', { data }));
    }

    close() {
      this.listeners = [];
    }
  }

  beforeEach(() => {
    MockBroadcastChannel.channels.clear();
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects a payload that hides its nesting inside an array', async () => {
    const first = createSvState({ deep: 'unset' as unknown }, undefined, {
      plugins: [syncPlugin({ key: 'arrays', throttle: 10 })]
    });
    const second = createSvState({ deep: 'unset' as unknown }, undefined, {
      plugins: [syncPlugin({ key: 'arrays', throttle: 10 })]
    });

    let nested: unknown = 'leaf';
    for (let index = 0; index < 15; index++) nested = [nested];
    first.data.deep = nested;
    await sleep(50);

    expect(second.data.deep).toBe('unset');
  });

  it('broadcasts a reset to the other tabs', async () => {
    const first = createSvState({ name: 'initial' }, undefined, {
      plugins: [syncPlugin({ key: 'reset', throttle: 10 })]
    });
    const second = createSvState({ name: 'initial' }, undefined, {
      plugins: [syncPlugin({ key: 'reset', throttle: 10 })]
    });

    first.data.name = 'changed';
    await sleep(50);
    expect(second.data.name).toBe('changed');

    first.reset();
    await sleep(50);
    expect(second.data.name).toBe('initial');
  });
});

/* eslint-disable unicorn/no-array-sort, unicorn/no-array-reverse, unicorn/no-return-array-push, unicorn/no-unnecessary-splice -- these tests exercise the in-place mutators on purpose */
const track = (items: number[]) => {
  const events: { property: string; currentValue: unknown; oldValue: unknown }[] = [];
  const data = ChangeProxy({ items }, (_target, property, currentValue, oldValue) =>
    events.push({ property, currentValue, oldValue })
  );
  return { data, events };
};

describe('array methods report one change per call', () => {
  it.each([
    ['splice', (items: number[]) => items.splice(0, 1), [2, 3, 4]],
    ['shift', (items: number[]) => items.shift(), [2, 3, 4]],
    ['unshift', (items: number[]) => items.unshift(0), [0, 1, 2, 3, 4]],
    ['sort', (items: number[]) => items.sort((a, b) => b - a), [4, 3, 2, 1]],
    ['reverse', (items: number[]) => items.reverse(), [4, 3, 2, 1]],
    ['pop', (items: number[]) => items.pop(), [1, 2, 3]],
    ['push', (items: number[]) => items.push(5), [1, 2, 3, 4, 5]]
  ])('%s', (_name, mutate, expected) => {
    const { data, events } = track([1, 2, 3, 4]);

    mutate(data.items);

    expect(events.length).toBe(1);
    expect(events[0]!.property).toBe('items');
    expect([...(events[0]!.currentValue as number[])]).toEqual(expected);
    expect(events[0]!.oldValue).toEqual([1, 2, 3, 4]);
  });

  it('reports nothing when the call changes nothing, and returns the method result', () => {
    const { data, events } = track([1, 2, 3]);

    expect(data.items.sort((a, b) => a - b)).toEqual([1, 2, 3]);
    expect(data.items.splice(5, 1)).toEqual([]);
    expect(events).toEqual([]);
    expect(data.items.pop()).toBe(3);
  });

  it('runs an effect once for one splice', () => {
    let runs = 0;
    const { data } = createSvState({ items: [1, 2, 3, 4] }, { effect: () => void runs++ });

    data.items.shift();

    expect(runs).toBe(1);
    expect(data.items).toEqual([2, 3, 4]);
  });
});

describe('per-row (array) validation errors', () => {
  type Row = { sku: string; quantity: number };
  const create = (asyncCalls: string[]) =>
    createSvState(
      { inventory: [{ sku: 'a', quantity: 1 }] as Row[] },
      {
        // Row-level errors as an array: expressible without a cast now that Validator admits arrays
        validator: (source) => ({
          inventory: source.inventory.map((row) => ({
            quantity: numberValidator(row.quantity).min(1).getError()
          }))
        }),
        asyncValidator: {
          'inventory.1.quantity': async (value) => {
            asyncCalls.push(String(value));
            return '';
          }
        }
      },
      { debounceAsyncValidation: 10 }
    );

  it('skips the async validator when the row already has a sync error', async () => {
    const asyncCalls: string[] = [];
    const { data, state } = create(asyncCalls);

    data.inventory = [
      { sku: 'a', quantity: 1 },
      { sku: 'b', quantity: 0 }
    ];
    await sleep(50);

    expect(asyncCalls).toEqual([]);
    expect(get(state.hasErrors)).toBe(true);
    expect(get(state.errors)?.inventory).toEqual([{ quantity: '' }, { quantity: 'Minimum 1' }]);
  });

  it('runs the async validator once the row is valid', async () => {
    const asyncCalls: string[] = [];
    const { data } = create(asyncCalls);

    data.inventory = [
      { sku: 'a', quantity: 1 },
      { sku: 'b', quantity: 3 }
    ];
    await sleep(50);

    expect(asyncCalls).toEqual(['3']);
  });
});

describe('fields inside array elements report their indexed path', () => {
  it('reports items.N.field and marks the row and the array dirty', () => {
    const { data, state } = createSvState({ items: [{ name: 'a' }, { name: 'b' }] });

    data.items[1]!.name = 'changed';

    expect(Object.keys(get(state.isDirtyByField)).toSorted((a, b) => a.localeCompare(b))).toEqual([
      'items',
      'items.1',
      'items.1.name'
    ]);
  });

  it('still reports element writes and array methods on the array path', () => {
    const paths: string[] = [];
    const { data } = createSvState({ items: [{ name: 'a' }] }, undefined, {
      plugins: [{ name: 'spy', onChange: (event) => void paths.push(event.property) }]
    });

    data.items[0] = { name: 'x' };
    data.items.push({ name: 'y' });

    expect(paths).toEqual(['items', 'items']);
  });

  it('triggers an async validator registered on an indexed path from a row edit', async () => {
    const values: unknown[] = [];
    const { data } = createSvState(
      { inventory: [{ quantity: 1 }, { quantity: 2 }] },
      {
        asyncValidator: {
          'inventory.1.quantity': async (value) => {
            values.push(value);
            return '';
          }
        }
      },
      { debounceAsyncValidation: 10 }
    );

    data.inventory[0]!.quantity = 5; // another row: must not trigger it
    data.inventory[1]!.quantity = 7;
    await sleep(50);

    expect(values).toEqual([7]);
  });

  it('follows a row to its new index after the array is reordered', () => {
    const paths: string[] = [];
    const { data } = createSvState({ items: [{ n: 1 }, { n: 2 }] }, undefined, {
      plugins: [{ name: 'spy', onChange: (event) => void paths.push(event.property) }]
    });

    data.items.reverse();
    paths.length = 0;
    data.items[0]!.n = 9;

    expect(paths).toEqual(['items.0.n']);
    expect(data.items[0]).toEqual({ n: 9 });
  });
});

describe('pathEffect', () => {
  it('runs only for matching paths, after the global effect, with the same context', () => {
    const calls: string[] = [];
    const { data } = createSvState(
      { qty: 1, price: 1, customer: { address: { city: 'a' }, name: 'n' } },
      {
        effect: ({ property }) => void calls.push(`effect:${property}`),
        pathEffect: {
          qty: ({ property, currentValue }) => void calls.push(`qty:${property}=${String(currentValue)}`),
          'customer.address': ({ property }) => void calls.push(`address:${property}`)
        }
      }
    );

    data.qty = 3;
    data.price = 2; // no match
    data.customer.address.city = 'b'; // descendant of a registered path
    data.customer = { address: { city: 'c' }, name: 'n' }; // ancestor of a registered path

    expect(calls).toEqual([
      'effect:qty',
      'qty:qty=3',
      'effect:price',
      'effect:customer.address.city',
      'address:customer.address.city',
      'effect:customer',
      'address:customer'
    ]);
  });

  it('rejects an async path effect like effect, and still runs plugins', () => {
    const changes: string[] = [];
    const { data } = createSvState(
      { a: 0 },
      { pathEffect: { a: (async () => {}) as unknown as () => void } },
      { plugins: [{ name: 'spy', onChange: (event) => void changes.push(event.property) }] }
    );

    expect(() => (data.a = 1)).toThrow('must be synchronous');
    expect(changes).toEqual(['a']);
  });
});
