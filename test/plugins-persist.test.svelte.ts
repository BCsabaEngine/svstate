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
