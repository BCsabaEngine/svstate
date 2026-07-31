import { get } from 'svelte/store';

import { persistPlugin } from '../src/plugins/persist';
import { createSvState } from '../src/state.svelte';

function createMockStorage() {
  const store = new Map<string, string>();
  return {
    // eslint-disable-next-line unicorn/no-null
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    _store: store
  };
}

describe('persistPlugin', () => {
  it('should hydrate state from storage on init', () => {
    const storage = createMockStorage();
    storage.setItem('test', JSON.stringify({ version: 1, data: { name: 'stored' } }));

    const persist = persistPlugin({ key: 'test', storage });
    const { data } = createSvState({ name: 'initial', count: 0 }, undefined, { plugins: [persist] });

    expect(data.name).toBe('stored');
    expect(data.count).toBe(0);
    expect(persist.isRestored()).toBe(true);
  });

  it('should not restore if no stored data', () => {
    const storage = createMockStorage();
    const persist = persistPlugin({ key: 'test', storage });
    const { data } = createSvState({ name: 'initial' }, undefined, { plugins: [persist] });

    expect(data.name).toBe('initial');
    expect(persist.isRestored()).toBe(false);
  });

  it('should throttle writes on rapid changes', async () => {
    const storage = createMockStorage();
    const persist = persistPlugin({ key: 'test', storage, throttle: 50 });
    const { data } = createSvState({ name: 'initial' }, undefined, { plugins: [persist] });

    data.name = 'a';
    data.name = 'b';
    data.name = 'c';

    // Should not have written yet
    expect(storage.getItem('test')).toBeNull();

    await new Promise((r) => setTimeout(r, 100));

    const stored = JSON.parse(storage.getItem('test')!);
    expect(stored.data.name).toBe('c');
  });

  it('should respect include paths', async () => {
    const storage = createMockStorage();
    const persist = persistPlugin({ key: 'test', storage, throttle: 10, include: ['name'] });
    const { data } = createSvState({ name: 'test', count: 5 }, undefined, { plugins: [persist] });

    data.name = 'updated';
    await new Promise((r) => setTimeout(r, 50));

    const stored = JSON.parse(storage.getItem('test')!);
    expect(stored.data.name).toBe('updated');
    expect(stored.data.count).toBeUndefined();
  });

  it('should respect exclude paths', async () => {
    const storage = createMockStorage();
    const persist = persistPlugin({ key: 'test', storage, throttle: 10, exclude: ['secret'] });
    const { data } = createSvState({ name: 'test', secret: 'hidden' }, undefined, { plugins: [persist] });

    data.name = 'updated';
    await new Promise((r) => setTimeout(r, 50));

    const stored = JSON.parse(storage.getItem('test')!);
    expect(stored.data.name).toBe('updated');
    expect(stored.data.secret).toBeUndefined();
  });

  it('should run migration when version changes', () => {
    const storage = createMockStorage();
    storage.setItem('test', JSON.stringify({ version: 1, data: { fullName: 'John Doe' } }));

    const persist = persistPlugin({
      key: 'test',
      storage,
      version: 2,
      migrate: (data, oldVersion) => {
        if (oldVersion === 1) {
          const old = data as { fullName: string };
          return { name: old.fullName };
        }
        return data;
      }
    });

    const { data } = createSvState({ name: 'initial' }, undefined, { plugins: [persist] });
    expect(data.name).toBe('John Doe');
  });

  it('should clearPersistedState', () => {
    const storage = createMockStorage();
    storage.setItem('test', JSON.stringify({ version: 1, data: { name: 'stored' } }));

    const persist = persistPlugin({ key: 'test', storage });
    createSvState({ name: 'initial' }, undefined, { plugins: [persist] });

    persist.clearPersistedState();
    expect(storage.getItem('test')).toBeNull();
  });

  it('should flush pending write on destroy', async () => {
    const storage = createMockStorage();
    const persist = persistPlugin({ key: 'test', storage, throttle: 5000 });
    const { data, destroy } = createSvState({ name: 'initial' }, undefined, { plugins: [persist] });

    data.name = 'updated';
    destroy();

    const stored = JSON.parse(storage.getItem('test')!);
    expect(stored.data.name).toBe('updated');
  });

  it('should write on reset', async () => {
    const storage = createMockStorage();
    const persist = persistPlugin({ key: 'test', storage, throttle: 10 });
    const { data, reset } = createSvState(
      { name: 'initial' },
      { effect: ({ snapshot }) => snapshot('Change') },
      { plugins: [persist] }
    );

    data.name = 'updated';
    // Wait for throttled write
    await new Promise((r) => setTimeout(r, 50));

    reset();
    // onReset fires writeToStorage synchronously
    const stored = JSON.parse(storage.getItem('test')!);
    expect(stored.data.name).toBe('initial');
  });
});

describe('persistPlugin hydration baseline', () => {
  it('should not mark restored fields dirty', () => {
    const storage = createMockStorage();
    storage.setItem('form', JSON.stringify({ version: 1, data: { name: 'restored' } }));

    const { data, state } = createSvState(
      { name: 'default' },
      {},
      {
        plugins: [persistPlugin({ key: 'form', storage })]
      }
    );

    expect(data.name).toBe('restored');
    expect(get(state.isDirty)).toBe(false);
    expect(get(state.isDirtyByField)).toEqual({});
  });

  it('should reset to the restored values, not the pre-restore defaults', () => {
    const storage = createMockStorage();
    storage.setItem('form', JSON.stringify({ version: 1, data: { name: 'restored' } }));

    const { data, reset, state } = createSvState(
      { name: 'default' },
      {},
      {
        plugins: [persistPlugin({ key: 'form', storage })]
      }
    );

    data.name = 'edited';
    reset();

    expect(data.name).toBe('restored');
    expect(get(state.snapshots)[0]?.data).toEqual({ name: 'restored' });
  });

  it('should report storage failures through onError instead of throwing', () => {
    const errors: unknown[] = [];
    const failingStorage = {
      // eslint-disable-next-line unicorn/no-null
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {}
    };

    const { data, destroy } = createSvState(
      { name: 'a' },
      {},
      {
        plugins: [
          persistPlugin({
            key: 'form',
            storage: failingStorage,
            throttle: 0,
            onError: (error) => {
              errors.push(error);
            }
          })
        ]
      }
    );

    data.name = 'b';
    expect(() => destroy()).not.toThrow();
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe('QuotaExceededError');
  });

  it('should write only once when destroy is called twice', () => {
    const storage = createMockStorage();
    let writes = 0;
    const countingStorage = {
      ...storage,
      setItem: (key: string, value: string) => {
        writes++;
        storage.setItem(key, value);
      }
    };

    const persist = persistPlugin({ key: 'test', storage: countingStorage, throttle: 50 });
    const { data } = createSvState({ name: 'a' }, undefined, { plugins: [persist] });

    data.name = 'b';

    // createSvState.destroy() is idempotent, so the plugin hook is exercised directly here
    persist.destroy?.();
    expect(writes).toBe(1);

    persist.destroy?.();
    expect(writes).toBe(1);
  });

  it('should not write on destroy when nothing changed', () => {
    const storage = createMockStorage();
    let writes = 0;
    const countingStorage = {
      ...storage,
      setItem: (key: string, value: string) => {
        writes++;
        storage.setItem(key, value);
      }
    };

    const persist = persistPlugin({ key: 'test', storage: countingStorage, throttle: 50 });
    const { destroy } = createSvState({ name: 'a' }, undefined, { plugins: [persist] });

    destroy();
    expect(writes).toBe(0);
  });

  it('should keep the pending write when destroy runs before the throttle elapses', async () => {
    const storage = createMockStorage();
    const persist = persistPlugin({ key: 'test', storage, throttle: 50 });
    const { data, destroy } = createSvState({ name: 'a' }, undefined, { plugins: [persist] });

    data.name = 'flushed';
    destroy();

    expect(JSON.parse(storage.getItem('test')!).data.name).toBe('flushed');

    // The cancelled timer must not fire a second write afterwards
    await new Promise((r) => setTimeout(r, 80));
    expect(JSON.parse(storage.getItem('test')!).data.name).toBe('flushed');
  });
});
