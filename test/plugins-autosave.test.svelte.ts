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
