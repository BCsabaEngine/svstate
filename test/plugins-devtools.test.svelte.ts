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

  it('should use custom name in log prefix', () => {
    const devtools = devtoolsPlugin({ enabled: true, name: 'myForm' });
    const { data } = createSvState({ name: 'test' }, undefined, { plugins: [devtools] });

    data.name = 'updated';

    const call = groupCollapsedSpy.mock.calls.find((c) => (c[0] as string).includes('[myForm]'));
    expect(call).toBeDefined();
  });
});
