import { devtoolsPlugin } from '../src/plugins/devtools';
import { createSvState } from '../src/state.svelte';

describe('devtoolsPlugin', () => {
  let groupCollapsedSpy: ReturnType<typeof vi.spyOn>;
  let groupSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let groupEndSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    groupCollapsedSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    groupSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    groupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log change events to console', () => {
    const devtools = devtoolsPlugin({ enabled: true });
    const { data } = createSvState({ name: 'test' }, undefined, { plugins: [devtools] });

    data.name = 'updated';

    expect(groupCollapsedSpy).toHaveBeenCalled();
    const callArgument = groupCollapsedSpy.mock.calls.find((c) => (c[0] as string).includes('change'));
    expect(callArgument).toBeDefined();
    expect(logSpy).toHaveBeenCalled();
    expect(groupEndSpy).toHaveBeenCalled();
  });

  it('should use console.group when collapsed is false', () => {
    const devtools = devtoolsPlugin({ enabled: true, collapsed: false });
    const { data } = createSvState({ name: 'test' }, undefined, { plugins: [devtools] });

    data.name = 'updated';

    expect(groupSpy).toHaveBeenCalled();
  });

  it('should skip logging when disabled', () => {
    const devtools = devtoolsPlugin({ enabled: false });
    const { data } = createSvState({ name: 'test' }, undefined, { plugins: [devtools] });

    data.name = 'updated';

    expect(groupCollapsedSpy).not.toHaveBeenCalled();
    expect(groupSpy).not.toHaveBeenCalled();
  });

  it('should respect logValidation toggle', () => {
    const devtools = devtoolsPlugin({ enabled: true, logValidation: false });
    createSvState({ name: '' }, { validator: (s) => ({ name: s.name ? '' : 'Required' }) }, { plugins: [devtools] });

    // Initial validation fires but logValidation is false
    const validationCalls = groupCollapsedSpy.mock.calls.filter((c) => (c[0] as string).includes('validation'));
    expect(validationCalls.length).toBe(0);
  });

  it('should log validation when logValidation is true', () => {
    const devtools = devtoolsPlugin({ enabled: true, logValidation: true });
    createSvState({ name: '' }, { validator: (s) => ({ name: s.name ? '' : 'Required' }) }, { plugins: [devtools] });

    const validationCalls = groupCollapsedSpy.mock.calls.filter((c) => (c[0] as string).includes('validation'));
    expect(validationCalls.length).toBe(1);
  });

  it('should log action events', async () => {
    const devtools = devtoolsPlugin({ enabled: true });
    const { execute } = createSvState({ name: 'test' }, { action: async () => {} }, { plugins: [devtools] });

    await execute();

    const actionCalls = groupCollapsedSpy.mock.calls.filter((c) => (c[0] as string).includes('action'));
    expect(actionCalls.length).toBe(2);
  });

  it('should default to enabled outside of production when enabled is not specified', () => {
    const devtools = devtoolsPlugin();
    const { data } = createSvState({ name: 'test' }, undefined, { plugins: [devtools] });

    data.name = 'updated';

    expect(groupCollapsedSpy).toHaveBeenCalled();
  });

  it('should include from/to values when logValues is true', () => {
    const devtools = devtoolsPlugin({ enabled: true, logValues: true });
    const { data } = createSvState({ name: 'old' }, undefined, { plugins: [devtools] });

    data.name = 'new';

    const changeDetail = logSpy.mock.calls.find((c) => (c[0] as { property?: string })?.property === 'name')?.[0] as
      { from?: string; to?: string } | undefined;
    expect(changeDetail).toEqual({ property: 'name', from: 'old', to: 'new' });
  });

  it('should log the error message when an action fails', async () => {
    const devtools = devtoolsPlugin({ enabled: true });
    const { execute } = createSvState(
      { name: 'test' },
      {
        action: async () => {
          throw new Error('boom');
        }
      },
      { plugins: [devtools] }
    );

    await execute();

    const errorDetail = logSpy.mock.calls.find((c) => (c[0] as { error?: string })?.error === 'boom');
    expect(errorDetail).toBeDefined();
  });

  it('should log snapshot, rollback and reset events', () => {
    const devtools = devtoolsPlugin({ enabled: true });
    const { data, rollback, reset } = createSvState(
      { name: 'initial' },
      { effect: ({ snapshot }) => snapshot('Changed') },
      { plugins: [devtools] }
    );

    data.name = 'updated';
    const snapshotCall = groupCollapsedSpy.mock.calls.find((c) => (c[0] as string).includes('snapshot'));
    expect(snapshotCall).toBeDefined();

    rollback();
    const rollbackCall = groupCollapsedSpy.mock.calls.find((c) => (c[0] as string).includes('rollback'));
    expect(rollbackCall).toBeDefined();

    reset();
    const resetCall = groupCollapsedSpy.mock.calls.find((c) => (c[0] as string).includes('reset'));
    expect(resetCall).toBeDefined();
  });

  it('should use custom name in log prefix', () => {
    const devtools = devtoolsPlugin({ enabled: true, name: 'myForm' });
    const { data } = createSvState({ name: 'test' }, undefined, { plugins: [devtools] });

    data.name = 'updated';

    const call = groupCollapsedSpy.mock.calls.find((c) => (c[0] as string).includes('[myForm]'));
    expect(call).toBeDefined();
  });
});
