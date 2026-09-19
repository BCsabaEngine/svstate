import { autosavePlugin } from '../src/plugins/autosave';
import { createSvState } from '../src/state.svelte';

describe('autosavePlugin', () => {
  it('should save after idle period', async () => {
    const saved: unknown[] = [];
    const autosave = autosavePlugin({
      save: (data) => {
        saved.push({ ...data });
      },
      idle: 50,
      onlyWhenDirty: false
    });
    const { data } = createSvState({ name: 'test' }, undefined, { plugins: [autosave] });

    data.name = 'updated';
    expect(saved.length).toBe(0);

    await new Promise((r) => setTimeout(r, 100));
    expect(saved.length).toBe(1);
    expect((saved[0] as Record<string, unknown>).name).toBe('updated');
  });

  it('should skip save when not dirty if onlyWhenDirty', async () => {
    const saved: unknown[] = [];
    const autosave = autosavePlugin({
      save: (data) => {
        saved.push({ ...data });
      },
      idle: 50,
      onlyWhenDirty: true
    });

    const { data, execute } = createSvState({ name: 'test' }, { action: async () => {} }, { plugins: [autosave] });

    data.name = 'updated';
    await execute(); // resets dirty

    // Trigger idle by making a new change — but isDirty was reset by action
    // The idle timer was set by onChange, but action clears idle
    // After action, isDirty is false. Let's trigger saveNow
    await autosave.saveNow();
    // Should not save since not dirty
    expect(saved.length).toBe(0);
  });

  it('should trigger immediate save with saveNow', async () => {
    const saved: unknown[] = [];
    const autosave = autosavePlugin({
      save: (data) => {
        saved.push({ ...data });
      },
      idle: 5000,
      onlyWhenDirty: false
    });
    const { data } = createSvState({ name: 'test' }, undefined, { plugins: [autosave] });

    data.name = 'updated';
    await autosave.saveNow();
    expect(saved.length).toBe(1);
  });

  it('should save on destroy when saveOnDestroy is true', () => {
    const saved: unknown[] = [];
    const autosave = autosavePlugin({
      save: (data) => {
        saved.push({ ...data });
      },
      idle: 5000,
      saveOnDestroy: true,
      onlyWhenDirty: false
    });
    const { data, destroy } = createSvState({ name: 'test' }, undefined, { plugins: [autosave] });

    data.name = 'updated';
    destroy();

    expect(saved.length).toBe(1);
  });

  it('should call onError on save failure', async () => {
    const errors: unknown[] = [];
    const autosave = autosavePlugin({
      save: () => {
        throw new Error('save failed');
      },
      idle: 50,
      onlyWhenDirty: false,
      onError: (error) => {
        errors.push(error);
      }
    });
    const { data } = createSvState({ name: 'test' }, undefined, { plugins: [autosave] });

    data.name = 'updated';
    await new Promise((r) => setTimeout(r, 100));

    expect(errors.length).toBe(1);
    expect((errors[0] as Error).message).toBe('save failed');
  });

  it('should fire interval timer periodically', async () => {
    const saved: unknown[] = [];
    const autosave = autosavePlugin({
      save: (data) => {
        saved.push({ ...data });
      },
      idle: 10_000,
      interval: 50,
      onlyWhenDirty: false
    });
    const { destroy } = createSvState({ name: 'test' }, undefined, { plugins: [autosave] });

    await new Promise((r) => setTimeout(r, 150));
    destroy();

    expect(saved.length).toBeGreaterThanOrEqual(2);
  });

  it('should run a save requested while one is already in flight instead of dropping it', async () => {
    const saveCalls: string[] = [];
    const { promise: inFlight, resolve: resolveInFlight } = Promise.withResolvers<void>();
    const autosave = autosavePlugin({
      save: async (data) => {
        saveCalls.push((data as { name: string }).name);
        if (saveCalls.length === 1) await inFlight;
      },
      idle: 5000,
      interval: 15,
      onlyWhenDirty: false,
      saveOnDestroy: false
    });
    const { data, destroy } = createSvState({ name: 'a' }, undefined, { plugins: [autosave] });

    // First interval tick starts the save and hangs on the unresolved promise
    await new Promise((r) => setTimeout(r, 25));
    expect(autosave.isSaving()).toBe(true);

    data.name = 'b';
    // A later interval tick requests a save while the first is still in flight, and must not be
    // dropped even though `isSaving` was true at request time
    await new Promise((r) => setTimeout(r, 25));

    resolveInFlight();
    await new Promise((r) => setTimeout(r, 15));
    destroy();

    expect(saveCalls[0]).toBe('a');
    expect(saveCalls).toContain('b');
    expect(autosave.isSaving()).toBe(false);
  });

  it('should not touch document when onVisibilityHidden is set but document is unavailable', () => {
    const autosave = autosavePlugin({
      save: () => {},
      onVisibilityHidden: true,
      saveOnDestroy: false
    });

    expect(() => {
      const { destroy } = createSvState({ name: 'a' }, undefined, { plugins: [autosave] });
      destroy();
    }).not.toThrow();
  });

  it('should clear idle timer after successful action', async () => {
    const saved: unknown[] = [];
    const autosave = autosavePlugin({
      save: (data) => {
        saved.push({ ...data });
      },
      idle: 50,
      onlyWhenDirty: true
    });
    const { data, execute } = createSvState({ name: 'test' }, { action: async () => {} }, { plugins: [autosave] });

    data.name = 'updated';
    await execute(); // This resets dirty and idle timer

    // Wait for what would have been the idle save
    await new Promise((r) => setTimeout(r, 100));
    // Save should not fire because isDirty is false after action
    expect(saved.length).toBe(0);
  });
});

describe('autosavePlugin - visibility, destroy and retry', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('saves when the page becomes hidden and stops listening after destroy', async () => {
    const listeners: (() => void)[] = [];
    const fakeDocument = {
      visibilityState: 'visible',
      addEventListener: (_type: string, handler: () => void) => void listeners.push(handler),
      removeEventListener: (_type: string, handler: () => void) => {
        const index = listeners.indexOf(handler);
        if (index !== -1) listeners.splice(index, 1);
      }
    };
    vi.stubGlobal('document', fakeDocument);

    const saved: string[] = [];
    const autosave = autosavePlugin<{ name: string }>({
      save: (data) => void saved.push(data.name),
      idle: 10_000,
      onVisibilityHidden: true,
      saveOnDestroy: false
    });
    const { data, destroy } = createSvState({ name: 'a' }, undefined, { plugins: [autosave] });
    data.name = 'b';

    expect(listeners.length).toBe(1);
    listeners[0]!(); // still visible: nothing happens
    await Promise.resolve();
    expect(saved).toEqual([]);

    fakeDocument.visibilityState = 'hidden';
    listeners[0]!();
    await Promise.resolve();
    expect(saved).toEqual(['b']);

    destroy();
    expect(listeners.length).toBe(0);
  });

  it('saveNow is a no-op after destroy and destroy does not save when nothing changed', async () => {
    const save = vi.fn();
    const autosave = autosavePlugin({ save, idle: 10_000 });
    const { destroy } = createSvState({ name: 'a' }, undefined, { plugins: [autosave] });

    destroy();
    await autosave.saveNow();

    expect(save).not.toHaveBeenCalled();
  });

  it('retries after a failed save on the next interval tick', async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const errors: unknown[] = [];
    const autosave = autosavePlugin({
      save: () => {
        attempts++;
        if (attempts === 1) throw new Error('offline');
      },
      idle: 10_000,
      interval: 100,
      onError: (error) => void errors.push(error)
    });
    const { data, destroy } = createSvState({ name: 'a' }, undefined, { plugins: [autosave] });

    data.name = 'b';
    await vi.advanceTimersByTimeAsync(100);
    expect(attempts).toBe(1);
    expect(errors.length).toBe(1);

    await vi.advanceTimersByTimeAsync(100);
    expect(attempts).toBe(2);

    await vi.advanceTimersByTimeAsync(300); // saved and unchanged: no more saves
    expect(attempts).toBe(2);
    destroy();
  });

  it('still saves after a rollback when onlyWhenDirty is false', async () => {
    const saved: string[] = [];
    const autosave = autosavePlugin<{ name: string }>({
      save: (data) => void saved.push(data.name),
      idle: 20,
      onlyWhenDirty: false
    });
    const { data, rollback } = createSvState(
      { name: 'initial' },
      { effect: ({ snapshot }) => snapshot('edit') },
      { plugins: [autosave] }
    );

    data.name = 'edited';
    rollback();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(saved).toEqual(['initial']);
  });
});
