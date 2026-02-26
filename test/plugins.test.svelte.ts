import { get } from 'svelte/store';

import type { ActionEvent, ChangeEvent, PluginContext, SvStatePlugin } from '../src/plugin';
import { createSvState, type Snapshot, type Validator } from '../src/state.svelte';

type SpyCall = { hook: string; args: unknown[] };

function spyPlugin<T extends Record<string, unknown>>(name = 'spy'): SvStatePlugin<T> & { calls: SpyCall[] } {
  const calls: SpyCall[] = [];
  return {
    name,
    calls,
    onInit(context: PluginContext<T>) {
      calls.push({ hook: 'onInit', args: [context] });
    },
    onChange(event: ChangeEvent<T>) {
      calls.push({ hook: 'onChange', args: [event] });
    },
    onValidation(errors: Validator | undefined) {
      calls.push({ hook: 'onValidation', args: [errors] });
    },
    onSnapshot(snapshot: Snapshot<T>) {
      calls.push({ hook: 'onSnapshot', args: [snapshot] });
    },
    onAction(event: ActionEvent) {
      calls.push({ hook: 'onAction', args: [event] });
    },
    onRollback(snapshot: Snapshot<T>) {
      calls.push({ hook: 'onRollback', args: [snapshot] });
    },
    onReset() {
      calls.push({ hook: 'onReset', args: [] });
    },
    destroy() {
      calls.push({ hook: 'destroy', args: [] });
    }
  };
}

describe('plugin system - core', () => {
  it('should work with no plugins', () => {
    const { data, state } = createSvState({ name: 'test' });
    data.name = 'updated';
    expect(data.name).toBe('updated');
    expect(get(state.isDirty)).toBe(true);
  });

  it('should call onInit with context', () => {
    const spy = spyPlugin();
    const { data } = createSvState({ name: 'test' }, undefined, { plugins: [spy] });

    const initCall = spy.calls.find((c) => c.hook === 'onInit');
    expect(initCall).toBeDefined();
    const context = initCall!.args[0] as PluginContext<Record<string, unknown>>;
    expect(context.data).toBe(data);
    expect(context.state).toBeDefined();
    expect(context.options).toBeDefined();
    expect(typeof context.snapshot).toBe('function');
  });

  it('should call onChange with correct event', () => {
    const spy = spyPlugin();
    const { data } = createSvState({ name: 'test', count: 0 }, undefined, { plugins: [spy] });

    data.name = 'updated';

    const changeCall = spy.calls.find((c) => c.hook === 'onChange');
    expect(changeCall).toBeDefined();
    const event = changeCall!.args[0] as ChangeEvent<Record<string, unknown>>;
    expect(event.property).toBe('name');
    expect(event.currentValue).toBe('updated');
    expect(event.oldValue).toBe('test');
  });

  it('should call onValidation after sync validation', async () => {
    const spy = spyPlugin();
    createSvState({ name: '' }, { validator: (s) => ({ name: s.name ? '' : 'Required' }) }, { plugins: [spy] });

    // Initial validation fires synchronously
    const validationCalls = spy.calls.filter((c) => c.hook === 'onValidation');
    expect(validationCalls.length).toBeGreaterThan(0);
    const errors = validationCalls[0]!.args[0] as Validator;
    expect(errors.name).toBe('Required');
  });

  it('should call onSnapshot when snapshot created in effect', () => {
    const spy = spyPlugin();
    const { data } = createSvState(
      { name: 'test' },
      { effect: ({ snapshot }) => snapshot('Change') },
      { plugins: [spy] }
    );

    data.name = 'updated';

    const snapshotCalls = spy.calls.filter((c) => c.hook === 'onSnapshot');
    expect(snapshotCalls.length).toBe(1);
    const snapshot = snapshotCalls[0]!.args[0] as Snapshot<Record<string, unknown>>;
    expect(snapshot.title).toBe('Change');
  });

  it('should call onAction with before and after phases', async () => {
    const spy = spyPlugin();
    const { execute } = createSvState({ name: 'test' }, { action: async () => {} }, { plugins: [spy] });

    await execute();

    const actionCalls = spy.calls.filter((c) => c.hook === 'onAction');
    expect(actionCalls.length).toBe(2);
    expect((actionCalls[0]!.args[0] as ActionEvent).phase).toBe('before');
    expect((actionCalls[1]!.args[0] as ActionEvent).phase).toBe('after');
  });

  it('should call onAction with error on failure', async () => {
    const spy = spyPlugin();
    const { execute } = createSvState(
      { name: 'test' },
      {
        action: async () => {
          throw new Error('fail');
        }
      },
      { plugins: [spy] }
    );

    await execute();

    const actionCalls = spy.calls.filter((c) => c.hook === 'onAction');
    expect(actionCalls.length).toBe(2);
    const afterEvent = actionCalls[1]!.args[0] as ActionEvent;
    expect(afterEvent.phase).toBe('after');
    expect(afterEvent.error).toBeInstanceOf(Error);
    expect(afterEvent.error!.message).toBe('fail');
  });

  it('should call onRollback with target snapshot', () => {
    const spy = spyPlugin();
    const { data, rollback } = createSvState(
      { name: 'test' },
      { effect: ({ snapshot }) => snapshot('Change') },
      { plugins: [spy] }
    );

    data.name = 'updated';
    rollback();

    const rollbackCalls = spy.calls.filter((c) => c.hook === 'onRollback');
    expect(rollbackCalls.length).toBe(1);
    const snapshot = rollbackCalls[0]!.args[0] as Snapshot<Record<string, unknown>>;
    expect(snapshot.data.name).toBe('test');
  });

  it('should call onReset', () => {
    const spy = spyPlugin();
    const { data, reset } = createSvState(
      { name: 'test' },
      { effect: ({ snapshot }) => snapshot('Change') },
      { plugins: [spy] }
    );

    data.name = 'updated';
    reset();

    const resetCalls = spy.calls.filter((c) => c.hook === 'onReset');
    expect(resetCalls.length).toBe(1);
  });

  it('should call destroy in reverse order', () => {
    const order: string[] = [];
    const plugin1: SvStatePlugin<Record<string, unknown>> = {
      name: 'first',
      destroy() {
        order.push('first');
      }
    };
    const plugin2: SvStatePlugin<Record<string, unknown>> = {
      name: 'second',
      destroy() {
        order.push('second');
      }
    };

    const { destroy } = createSvState({ name: 'test' }, undefined, {
      plugins: [plugin1, plugin2]
    });

    destroy();
    expect(order).toEqual(['second', 'first']);
  });

  it('should execute plugins in array order', () => {
    const order: string[] = [];
    const plugin1: SvStatePlugin<Record<string, unknown>> = {
      name: 'first',
      onChange() {
        order.push('first');
      }
    };
    const plugin2: SvStatePlugin<Record<string, unknown>> = {
      name: 'second',
      onChange() {
        order.push('second');
      }
    };

    const { data } = createSvState({ name: 'test' }, undefined, {
      plugins: [plugin1, plugin2]
    });

    data.name = 'updated';
    expect(order).toEqual(['first', 'second']);
  });

  it('should handle plugins with only some hooks defined', () => {
    const plugin: SvStatePlugin<Record<string, unknown>> = {
      name: 'minimal'
    };

    const { data, destroy } = createSvState({ name: 'test' }, undefined, {
      plugins: [plugin]
    });

    // Should not throw
    data.name = 'updated';
    destroy();
  });

  it('should compose multiple plugins without interference', async () => {
    const spy1 = spyPlugin('spy1');
    const spy2 = spyPlugin('spy2');

    const { data, execute } = createSvState(
      { name: 'test' },
      {
        action: async () => {},
        effect: ({ snapshot }) => snapshot('Change')
      },
      { plugins: [spy1, spy2] }
    );

    data.name = 'updated';
    await execute();

    // Both should have received the same hooks
    expect(spy1.calls.filter((c) => c.hook === 'onChange').length).toBe(1);
    expect(spy2.calls.filter((c) => c.hook === 'onChange').length).toBe(1);
    expect(spy1.calls.filter((c) => c.hook === 'onAction').length).toBe(2);
    expect(spy2.calls.filter((c) => c.hook === 'onAction').length).toBe(2);
  });

  it('should call onRollback for rollbackTo', () => {
    const spy = spyPlugin();
    const { data, rollbackTo } = createSvState(
      { name: 'test' },
      { effect: ({ snapshot, property }) => snapshot(`Changed ${property}`) },
      { plugins: [spy] }
    );

    data.name = 'first';
    data.name = 'second';
    const result = rollbackTo('Changed name');

    expect(result).toBe(true);
    const rollbackCalls = spy.calls.filter((c) => c.hook === 'onRollback');
    expect(rollbackCalls.length).toBe(1);
  });
});
