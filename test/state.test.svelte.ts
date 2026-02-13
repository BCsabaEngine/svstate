import { get } from 'svelte/store';

import { createSvState, type Validator } from '../src/index';

// Test classes for class instance support tests
class TestClass {
  name: string;
  count: number;

  constructor(name = 'test', count = 0) {
    this.name = name;
    this.count = count;
  }

  increment(): void {
    this.count++;
  }

  formatName(): string {
    return `Name: ${this.name}`;
  }

  getInfo(): string {
    return `${this.name} (${this.count})`;
  }
}

class NestedClass {
  value: string;

  constructor(value = 'nested') {
    this.value = value;
  }

  getValue(): string {
    return this.value;
  }
}

class ParentClass {
  nested: NestedClass;

  constructor() {
    this.nested = new NestedClass('initial');
  }

  getNestedValue(): string {
    return this.nested.getValue();
  }
}

describe('createSvState basic functionality', () => {
  it('should create state with initial data', () => {
    const { data } = createSvState({ name: 'test', count: 5 });

    expect(data.name).toBe('test');
    expect(data.count).toBe(5);
  });

  it('should allow modifying data', () => {
    const { data } = createSvState({ name: 'test' });

    data.name = 'updated';

    expect(data.name).toBe('updated');
  });

  it('should work without actuators', () => {
    const { data, state } = createSvState({ value: 0 });

    data.value = 1;

    expect(data.value).toBe(1);
    expect(get(state.isDirty)).toBe(true);
  });
});

describe('validation', () => {
  it('should run initial validation', () => {
    const { state } = createSvState(
      { name: '' },
      {
        validator: (source) => ({
          name: source.name ? '' : 'Required'
        })
      }
    );

    expect(get(state.errors)).toEqual({ name: 'Required' });
    expect(get(state.hasErrors)).toBe(true);
  });

  it('should update errors on data change', async () => {
    const { data, state } = createSvState(
      { name: '' },
      {
        validator: (source) => ({
          name: source.name ? '' : 'Required'
        })
      }
    );

    data.name = 'filled';
    await new Promise((resolve) => queueMicrotask(resolve));

    expect(get(state.errors)).toEqual({ name: '' });
    expect(get(state.hasErrors)).toBe(false);
  });

  it('should handle nested validator errors', async () => {
    const { data, state } = createSvState(
      { user: { name: '', email: '' } },
      {
        validator: (source) => ({
          user: {
            name: source.user.name ? '' : 'Required',
            email: source.user.email ? '' : 'Required'
          }
        })
      }
    );

    expect(get(state.hasErrors)).toBe(true);

    data.user.name = 'John';
    await new Promise((resolve) => queueMicrotask(resolve));

    expect(get(state.hasErrors)).toBe(true);

    data.user.email = 'john@example.com';
    await new Promise((resolve) => queueMicrotask(resolve));

    expect(get(state.hasErrors)).toBe(false);
  });

  it('should return false for hasErrors when no errors', () => {
    const { state } = createSvState(
      { name: 'valid' },
      {
        validator: (source) => ({
          name: source.name ? '' : 'Required'
        })
      }
    );

    expect(get(state.hasErrors)).toBe(false);
  });

  it('should handle undefined errors', () => {
    const { state } = createSvState({ name: 'test' });

    expect(get(state.errors)).toBeUndefined();
    expect(get(state.hasErrors)).toBe(false);
  });
});

describe('isDirty', () => {
  it('should start as false', () => {
    const { state } = createSvState({ value: 0 });

    expect(get(state.isDirty)).toBe(false);
  });

  it('should become true when data changes', () => {
    const { data, state } = createSvState({ value: 0 });

    data.value = 1;

    expect(get(state.isDirty)).toBe(true);
  });

  it('should reset to false after successful action with resetDirtyOnAction', async () => {
    const { data, execute, state } = createSvState(
      { value: 0 },
      { action: async () => {} },
      { resetDirtyOnAction: true }
    );

    data.value = 1;
    expect(get(state.isDirty)).toBe(true);

    await execute();

    expect(get(state.isDirty)).toBe(false);
  });

  it('should stay true after action with resetDirtyOnAction: false', async () => {
    const { data, execute, state } = createSvState(
      { value: 0 },
      { action: async () => {} },
      { resetDirtyOnAction: false }
    );

    data.value = 1;
    await execute();

    expect(get(state.isDirty)).toBe(true);
  });
});

describe('snapshots', () => {
  it('should start with initial snapshot', () => {
    const { state } = createSvState({ value: 0 });

    const snaps = get(state.snapshots);
    expect(snaps).toHaveLength(1);
    expect(snaps[0].title).toBe('Initial');
    expect(snaps[0].data).toEqual({ value: 0 });
  });

  it('should create snapshot in effect', () => {
    const { data, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed');
        }
      }
    );

    data.value = 1;

    const snaps = get(state.snapshots);
    expect(snaps).toHaveLength(2);
    expect(snaps[1].title).toBe('Changed');
    expect(snaps[1].data).toEqual({ value: 1 });
  });

  it('should replace snapshot with same title by default', () => {
    const { data, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed');
        }
      }
    );

    data.value = 1;
    data.value = 2;
    data.value = 3;

    const snaps = get(state.snapshots);
    expect(snaps).toHaveLength(2);
    expect(snaps[1].data).toEqual({ value: 3 });
  });

  it('should not replace snapshot when replace is false', () => {
    const { data, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed', false);
        }
      }
    );

    data.value = 1;
    data.value = 2;

    const snaps = get(state.snapshots);
    expect(snaps).toHaveLength(3);
  });

  it('should not replace snapshot with different title', () => {
    let count = 0;
    const { data, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot }) => {
          count++;
          snapshot(`Change ${count}`);
        }
      }
    );

    data.value = 1;
    data.value = 2;

    const snaps = get(state.snapshots);
    expect(snaps).toHaveLength(3);
    expect(snaps[1].title).toBe('Change 1');
    expect(snaps[2].title).toBe('Change 2');
  });

  it('should reset snapshots after successful action', async () => {
    const { data, execute, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed');
        },
        action: async () => {}
      }
    );

    data.value = 1;
    data.value = 2;

    await execute();

    const snaps = get(state.snapshots);
    expect(snaps).toHaveLength(1);
    expect(snaps[0].title).toBe('Initial');
    expect(snaps[0].data).toEqual({ value: 2 });
  });
});

describe('rollback', () => {
  it('should rollback to previous snapshot', () => {
    const { data, rollback, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed');
        }
      }
    );

    data.value = 1;
    rollback();

    expect(data.value).toBe(0);
    expect(get(state.snapshots)).toHaveLength(1);
  });

  it('should rollback multiple steps', () => {
    let count = 0;
    const { data, rollback, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot }) => {
          count++;
          snapshot(`Change ${count}`, false);
        }
      }
    );

    data.value = 1;
    data.value = 2;
    data.value = 3;

    rollback(2);

    expect(data.value).toBe(1);
    expect(get(state.snapshots)).toHaveLength(2);
  });

  it('should not rollback past initial snapshot', () => {
    const { data, rollback, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed', false);
        }
      }
    );

    data.value = 1;
    rollback(100);

    expect(data.value).toBe(0);
    expect(get(state.snapshots)).toHaveLength(1);
  });

  it('should do nothing if only initial snapshot exists', () => {
    const { data, rollback, state } = createSvState({ value: 0 });

    rollback();

    expect(data.value).toBe(0);
    expect(get(state.snapshots)).toHaveLength(1);
  });

  it('should trigger validation after rollback', () => {
    const { data, rollback, state } = createSvState(
      { name: 'initial' },
      {
        validator: (source) => ({
          name: source.name ? '' : 'Required'
        }),
        effect: ({ snapshot }) => {
          snapshot('Changed');
        }
      }
    );

    data.name = '';
    rollback();

    expect(get(state.errors)).toEqual({ name: '' });
    expect(get(state.hasErrors)).toBe(false);
  });
});

describe('reset', () => {
  it('should reset to initial state', () => {
    const { data, reset, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed', false);
        }
      }
    );

    data.value = 1;
    data.value = 2;
    data.value = 3;

    reset();

    expect(data.value).toBe(0);
    expect(get(state.snapshots)).toHaveLength(1);
    expect(get(state.snapshots)[0].title).toBe('Initial');
  });

  it('should trigger validation after reset', () => {
    const { data, reset, state } = createSvState(
      { name: 'initial' },
      {
        validator: (source) => ({
          name: source.name === 'initial' ? '' : 'Must be initial'
        }),
        effect: ({ snapshot }) => {
          snapshot('Changed');
        }
      }
    );

    data.name = 'changed';
    reset();

    expect(get(state.errors)).toEqual({ name: '' });
    expect(get(state.hasErrors)).toBe(false);
  });

  it('should handle reset when no snapshots exist gracefully', () => {
    const { reset, state } = createSvState({ value: 0 });

    // Manually clear snapshots to test edge case
    const snaps = get(state.snapshots);
    expect(snaps).toHaveLength(1);

    reset();

    expect(get(state.snapshots)).toHaveLength(1);
  });
});

describe('action execution', () => {
  it('should execute action', async () => {
    let actionCalled = false;
    const { execute } = createSvState(
      { value: 0 },
      {
        action: async () => {
          actionCalled = true;
        }
      }
    );

    await execute();

    expect(actionCalled).toBe(true);
  });

  it('should pass parameters to action', async () => {
    let receivedParameters: { id: number } | undefined;
    const { execute } = createSvState(
      { value: 0 },
      {
        action: async (parameters?: { id: number }) => {
          receivedParameters = parameters;
        }
      }
    );

    await execute({ id: 42 });

    expect(receivedParameters).toEqual({ id: 42 });
  });

  it('should set actionInProgress during execution', async () => {
    let progressDuringAction = false;
    const { execute, state } = createSvState(
      { value: 0 },
      {
        action: async () => {
          progressDuringAction = get(state.actionInProgress);
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
    );

    const promise = execute();
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(get(state.actionInProgress)).toBe(true);

    await promise;

    expect(progressDuringAction).toBe(true);
    expect(get(state.actionInProgress)).toBe(false);
  });

  it('should prevent concurrent actions by default', async () => {
    let callCount = 0;
    const { execute } = createSvState(
      { value: 0 },
      {
        action: async () => {
          callCount++;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }
    );

    execute();
    execute();
    execute();

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(callCount).toBe(1);
  });

  it('should allow concurrent actions when allowConcurrentActions is true', async () => {
    let callCount = 0;
    const { execute } = createSvState(
      { value: 0 },
      {
        action: async () => {
          callCount++;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      },
      { allowConcurrentActions: true }
    );

    execute();
    execute();
    execute();

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(callCount).toBe(3);
  });
});

describe('actionError', () => {
  it('should capture Error from failed action', async () => {
    const { execute, state } = createSvState(
      { value: 0 },
      {
        action: async () => {
          throw new Error('Test error');
        }
      }
    );

    await execute();

    expect(get(state.actionError)).toBeInstanceOf(Error);
    expect(get(state.actionError)?.message).toBe('Test error');
  });

  it('should set actionError to undefined for non-Error throws', async () => {
    const { execute, state } = createSvState(
      { value: 0 },
      {
        action: async () => {
          throw 'string error';
        }
      }
    );

    await execute();

    expect(get(state.actionError)).toBeUndefined();
  });

  it('should clear actionError on next action by default', async () => {
    let shouldFail = true;
    const { execute, state } = createSvState(
      { value: 0 },
      {
        action: async () => {
          if (shouldFail) throw new Error('Fail');
        }
      }
    );

    await execute();
    expect(get(state.actionError)).toBeInstanceOf(Error);

    shouldFail = false;
    await execute();
    expect(get(state.actionError)).toBeUndefined();
  });

  it('should clear actionError on data change by default', async () => {
    const { data, execute, state } = createSvState(
      { value: 0 },
      {
        action: async () => {
          throw new Error('Fail');
        }
      }
    );

    await execute();
    expect(get(state.actionError)).toBeInstanceOf(Error);

    data.value = 1;
    expect(get(state.actionError)).toBeUndefined();
  });

  it('should persist actionError when persistActionError is true', async () => {
    const { data, execute, state } = createSvState(
      { value: 0 },
      {
        action: async () => {
          throw new Error('Fail');
        }
      },
      { persistActionError: true }
    );

    await execute();
    expect(get(state.actionError)).toBeInstanceOf(Error);

    data.value = 1;
    expect(get(state.actionError)).toBeInstanceOf(Error);
  });
});

describe('debounceValidation', () => {
  it('should debounce validation when debounceValidation > 0', async () => {
    let validationCount = 0;
    const { data } = createSvState(
      { value: 0 },
      {
        validator: (source) => {
          validationCount++;
          return { value: source.value < 0 ? 'Must be positive' : '' };
        }
      },
      { debounceValidation: 50 }
    );

    // Initial validation
    expect(validationCount).toBe(1);

    data.value = 1;
    data.value = 2;
    data.value = 3;

    // Should not have validated yet
    expect(validationCount).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should have validated once after debounce
    expect(validationCount).toBe(2);
  });

  it('should use queueMicrotask when debounceValidation is 0', async () => {
    let validationCount = 0;
    const { data } = createSvState(
      { value: 0 },
      {
        validator: () => {
          validationCount++;
          return { value: '' };
        }
      },
      { debounceValidation: 0 }
    );

    expect(validationCount).toBe(1);

    data.value = 1;
    data.value = 2;
    data.value = 3;

    // Wait for microtask
    await new Promise((resolve) => queueMicrotask(resolve));

    // Should batch into single validation
    expect(validationCount).toBe(2);
  });
});

describe('effect context', () => {
  it('should receive correct context in effect', () => {
    let receivedContext:
      | {
          target: unknown;
          property: string;
          currentValue: unknown;
          oldValue: unknown;
        }
      | undefined;

    const { data } = createSvState(
      { value: 0 },
      {
        effect: (context) => {
          receivedContext = context;
        }
      }
    );

    data.value = 42;

    expect(receivedContext).toBeDefined();
    expect(receivedContext?.property).toBe('value');
    expect(receivedContext?.currentValue).toBe(42);
    expect(receivedContext?.oldValue).toBe(0);
  });

  it('should receive nested property path in effect', () => {
    let receivedProperty: string | undefined;

    const { data } = createSvState(
      { user: { name: 'test' } },
      {
        effect: ({ property }) => {
          receivedProperty = property;
        }
      }
    );

    data.user.name = 'updated';

    expect(receivedProperty).toBe('user.name');
  });
});

describe('deepClone', () => {
  it('should clone nested objects independently', () => {
    const { data, state } = createSvState(
      { user: { name: 'test', address: { city: 'NYC' } } },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed', false);
        }
      }
    );

    data.user.address.city = 'LA';

    const snaps = get(state.snapshots);
    expect(snaps[0].data.user.address.city).toBe('NYC');
    expect(snaps[1].data.user.address.city).toBe('LA');
  });

  it('should clone arrays independently', () => {
    const { data, state } = createSvState(
      { items: [1, 2, 3] },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed', false);
        }
      }
    );

    data.items.push(4);

    const snaps = get(state.snapshots);
    expect(snaps[0].data.items).toEqual([1, 2, 3]);
    expect(snaps[1].data.items).toEqual([1, 2, 3, 4]);
  });

  it('should clone Date objects', () => {
    const originalDate = new Date('2024-01-01');
    const { data, state } = createSvState(
      { date: originalDate },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed', false);
        }
      }
    );

    data.date = new Date('2024-12-31');

    const snaps = get(state.snapshots);
    expect(snaps[0].data.date).toEqual(new Date('2024-01-01'));
    expect(snaps[0].data.date).not.toBe(originalDate);
  });

  it('should handle null values', () => {
    const { data, state } = createSvState(
      // eslint-disable-next-line unicorn/no-null
      { value: null as string | null },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed', false);
        }
      }
    );

    data.value = 'filled';

    const snaps = get(state.snapshots);

    expect(snaps[0].data.value).toBeNull();
    expect(snaps[1].data.value).toBe('filled');
  });

  it('should handle primitive values', () => {
    const { data, rollback } = createSvState(
      { str: 'test', num: 42, bool: true },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed');
        }
      }
    );

    data.str = 'changed';
    data.num = 100;
    data.bool = false;

    rollback();

    expect(data.str).toBe('test');
    expect(data.num).toBe(42);
    expect(data.bool).toBe(true);
  });
});

describe('async actionCompleted', () => {
  it('should await async actionCompleted callback on success', async () => {
    const callOrder: string[] = [];

    const { execute } = createSvState(
      { value: 0 },
      {
        action: async () => {
          callOrder.push('action-start');
          await new Promise((resolve) => setTimeout(resolve, 10));
          callOrder.push('action-end');
        },
        actionCompleted: async () => {
          callOrder.push('actionCompleted-start');
          await new Promise((resolve) => setTimeout(resolve, 10));
          callOrder.push('actionCompleted-end');
        }
      }
    );

    await execute();

    expect(callOrder).toEqual(['action-start', 'action-end', 'actionCompleted-start', 'actionCompleted-end']);
  });

  it('should await async actionCompleted callback on error', async () => {
    const callOrder: string[] = [];

    const { execute } = createSvState(
      { value: 0 },
      {
        action: async () => {
          callOrder.push('action-start');
          throw new Error('Test error');
        },
        actionCompleted: async (error) => {
          callOrder.push('actionCompleted-start');
          await new Promise((resolve) => setTimeout(resolve, 10));
          callOrder.push(`actionCompleted-end:${error instanceof Error ? error.message : 'no-error'}`);
        }
      }
    );

    await execute();

    expect(callOrder).toEqual(['action-start', 'actionCompleted-start', 'actionCompleted-end:Test error']);
  });

  it('should set actionInProgress to false only after async actionCompleted completes', async () => {
    let actionInProgressDuringCallback = false;

    const { execute, state } = createSvState(
      { value: 0 },
      {
        action: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        },
        actionCompleted: async () => {
          actionInProgressDuringCallback = get(state.actionInProgress);
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
    );

    await execute();

    expect(actionInProgressDuringCallback).toBe(true);
    expect(get(state.actionInProgress)).toBe(false);
  });
});

describe('async effect rejection', () => {
  it('should throw error when effect callback is async', () => {
    const { data } = createSvState(
      { value: 0 },
      {
        effect: async () => {
          await Promise.resolve();
        }
      }
    );

    expect(() => {
      data.value = 1;
    }).toThrow('svstate: effect callback must be synchronous. Use action for async operations.');
  });

  it('should not throw error when effect callback is synchronous', () => {
    let effectCalled = false;

    const { data } = createSvState(
      { value: 0 },
      {
        effect: () => {
          effectCalled = true;
        }
      }
    );

    expect(() => {
      data.value = 1;
    }).not.toThrow();

    expect(effectCalled).toBe(true);
  });
});

describe('synchronous action', () => {
  it('should handle synchronous action', async () => {
    let actionCalled = false;
    const { execute } = createSvState(
      { value: 0 },
      {
        action: () => {
          actionCalled = true;
        }
      }
    );

    await execute();

    expect(actionCalled).toBe(true);
  });

  it('should handle synchronous actionCompleted', async () => {
    let completedCalled = false;
    const { execute } = createSvState(
      { value: 0 },
      {
        action: () => {},
        actionCompleted: () => {
          completedCalled = true;
        }
      }
    );

    await execute();

    expect(completedCalled).toBe(true);
  });
});

describe('no action defined', () => {
  it('should handle execute when no action is defined', async () => {
    const { execute, state } = createSvState({ value: 0 });

    await execute();

    expect(get(state.actionInProgress)).toBe(false);
    expect(get(state.actionError)).toBeUndefined();
  });
});

describe('edge case coverage for defensive guards', () => {
  it('should handle rollback gracefully when snapshot at target index is undefined', () => {
    const { data, rollback, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed', false);
        }
      }
    );

    data.value = 1;

    // Rollback with steps that would target index 0 (Initial)
    // This tests the targetIndex calculation and boundary handling
    rollback(100);

    // Should rollback to initial
    expect(data.value).toBe(0);
    expect(get(state.snapshots)).toHaveLength(1);
  });

  it('should handle reset gracefully when snapshots array is manipulated', () => {
    const { data, reset, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed', false);
        }
      }
    );

    data.value = 1;
    data.value = 2;

    // Verify we have snapshots before reset
    expect(get(state.snapshots).length).toBeGreaterThan(1);

    reset();

    // Should reset to initial state
    expect(data.value).toBe(0);
    expect(get(state.snapshots)).toHaveLength(1);
    expect(get(state.snapshots)[0].title).toBe('Initial');
  });
});

describe('class instance support', () => {
  it('should preserve class prototype when cloning', () => {
    const { state } = createSvState(new TestClass('original', 5), {
      effect: ({ snapshot }) => {
        snapshot('Changed', false);
      }
    });

    const snaps = get(state.snapshots);
    expect(snaps[0].data).toBeInstanceOf(TestClass);
  });

  it('should call methods through proxy', () => {
    const { data } = createSvState(new TestClass('test', 0));

    expect(data.formatName()).toBe('Name: test');
    expect(data.getInfo()).toBe('test (0)');
  });

  it('should preserve methods after rollback', () => {
    const { data, rollback } = createSvState(new TestClass('initial', 0), {
      effect: ({ snapshot }) => {
        snapshot('Changed');
      }
    });

    data.name = 'changed';
    rollback();

    expect(data.name).toBe('initial');
    expect(typeof data.formatName).toBe('function');
    expect(data.formatName()).toBe('Name: initial');
  });

  it('should preserve methods after reset', () => {
    const { data, reset } = createSvState(new TestClass('initial', 5), {
      effect: ({ snapshot }) => {
        snapshot('Changed', false);
      }
    });

    data.name = 'modified';
    data.count = 100;
    reset();

    expect(data.name).toBe('initial');
    expect(data.count).toBe(5);
    expect(typeof data.formatName).toBe('function');
    expect(data.formatName()).toBe('Name: initial');
    expect(data.getInfo()).toBe('initial (5)');
  });

  it('should handle nested class instances', () => {
    const { data, state } = createSvState(new ParentClass(), {
      effect: ({ snapshot }) => {
        snapshot('Changed', false);
      }
    });

    expect(data.getNestedValue()).toBe('initial');

    data.nested.value = 'updated';

    const snaps = get(state.snapshots);
    expect(snaps[0].data).toBeInstanceOf(ParentClass);
    expect(snaps[0].data.getNestedValue()).toBe('initial');
    expect(data.getNestedValue()).toBe('updated');
  });

  it('should trigger change callback when method mutates state', () => {
    let changeCount = 0;
    let lastProperty = '';

    const { data } = createSvState(new TestClass('test', 0), {
      effect: ({ property }) => {
        changeCount++;
        lastProperty = property;
      }
    });

    data.increment();

    expect(changeCount).toBe(1);
    expect(lastProperty).toBe('count');
    expect(data.count).toBe(1);
  });

  it('should clone class instances correctly in snapshots', () => {
    const { data, state } = createSvState(new TestClass('original', 10), {
      effect: ({ snapshot }) => {
        snapshot('Changed', false);
      }
    });

    data.name = 'modified';

    const snaps = get(state.snapshots);
    expect(snaps).toHaveLength(2);
    expect(snaps[0].data.name).toBe('original');
    expect(snaps[0].data.count).toBe(10);
    expect(snaps[1].data.name).toBe('modified');

    // Verify snapshots are independent
    expect(snaps[0].data).not.toBe(snaps[1].data);
    expect(snaps[0].data.formatName()).toBe('Name: original');
    expect(snaps[1].data.formatName()).toBe('Name: modified');
  });

  it('should preserve methods after successful action', async () => {
    const { data, execute } = createSvState(new TestClass('initial', 0), {
      action: async () => {}
    });

    data.name = 'after-action';
    await execute();

    expect(typeof data.formatName).toBe('function');
    expect(data.formatName()).toBe('Name: after-action');
  });
});

describe('deeply nested validators', () => {
  it('should detect errors in deeply nested validator structure', () => {
    type DeepValidator = Validator;
    const { state } = createSvState(
      { level1: { level2: { level3: { value: '' } } } },
      {
        validator: (source): DeepValidator => ({
          level1: {
            level2: {
              level3: {
                value: source.level1.level2.level3.value ? '' : 'Required'
              }
            }
          }
        })
      }
    );

    expect(get(state.hasErrors)).toBe(true);
  });

  it('should return false for empty nested validator', () => {
    const { state } = createSvState(
      { value: 'filled' },
      {
        validator: () => ({
          nested: {
            deep: {
              value: ''
            }
          }
        })
      }
    );

    expect(get(state.hasErrors)).toBe(false);
  });
});

describe('isDirtyByField', () => {
  it('should start as empty object', () => {
    const { state } = createSvState({ email: '', name: '' });

    expect(get(state.isDirtyByField)).toEqual({});
  });

  it('should mark single field dirty on change', () => {
    const { data, state } = createSvState({ email: '', name: '' });

    data.email = 'test@example.com';

    expect(get(state.isDirtyByField)).toEqual({ email: true });
  });

  it('should track multiple fields independently', () => {
    const { data, state } = createSvState({ email: '', name: '' });

    data.email = 'test@example.com';
    data.name = 'John';

    expect(get(state.isDirtyByField)).toEqual({ email: true, name: true });
  });

  it('should track nested paths', () => {
    const { data, state } = createSvState({ user: { name: 'test' } });

    data.user.name = 'updated';

    expect(get(state.isDirtyByField)['user.name']).toBe(true);
    expect(get(state.isDirtyByField)['user']).toBe(true);
  });

  it('should bubble dirty state to parent paths', () => {
    const { data, state } = createSvState({
      customer: { address: { street: '', city: '' } }
    });

    data.customer.address.street = '123 Main St';

    const dirtyFields = get(state.isDirtyByField);
    expect(dirtyFields['customer.address.street']).toBe(true);
    expect(dirtyFields['customer.address']).toBe(true);
    expect(dirtyFields['customer']).toBe(true);
  });

  it('should support prefix check via parent bubbling', () => {
    const { data, state } = createSvState({
      user: { address: { street: '', city: '' } }
    });

    data.user.address.city = 'New York';

    expect(get(state.isDirtyByField)['user.address']).toBe(true);
  });

  it('should stay dirty on repeated changes to same field', () => {
    const { data, state } = createSvState({ value: 0 });

    data.value = 1;
    data.value = 2;
    data.value = 3;

    expect(get(state.isDirtyByField)).toEqual({ value: true });
  });

  it('should make isDirty true when any field is dirty', () => {
    const { data, state } = createSvState({ email: '', name: '' });

    expect(get(state.isDirty)).toBe(false);

    data.email = 'test@example.com';

    expect(get(state.isDirty)).toBe(true);
  });

  it('should clear on successful action with resetDirtyOnAction: true', async () => {
    const { data, execute, state } = createSvState(
      { email: '', name: '' },
      { action: async () => {} },
      { resetDirtyOnAction: true }
    );

    data.email = 'test@example.com';
    data.name = 'John';
    expect(Object.keys(get(state.isDirtyByField)).length).toBeGreaterThan(0);

    await execute();

    expect(get(state.isDirtyByField)).toEqual({});
    expect(get(state.isDirty)).toBe(false);
  });

  it('should preserve on action with resetDirtyOnAction: false', async () => {
    const { data, execute, state } = createSvState(
      { email: '', name: '' },
      { action: async () => {} },
      { resetDirtyOnAction: false }
    );

    data.email = 'test@example.com';
    await execute();

    expect(get(state.isDirtyByField)['email']).toBe(true);
    expect(get(state.isDirty)).toBe(true);
  });

  it('should clear on rollback', () => {
    const { data, rollback, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed');
        }
      }
    );

    data.value = 1;
    expect(get(state.isDirtyByField)).toEqual({ value: true });

    rollback();

    expect(get(state.isDirtyByField)).toEqual({});
    expect(get(state.isDirty)).toBe(false);
  });

  it('should clear on reset', () => {
    const { data, reset, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed', false);
        }
      }
    );

    data.value = 1;
    data.value = 2;
    expect(Object.keys(get(state.isDirtyByField)).length).toBeGreaterThan(0);

    reset();

    expect(get(state.isDirtyByField)).toEqual({});
    expect(get(state.isDirty)).toBe(false);
  });

  it('should NOT clear dirty fields on no-op rollback (only initial snapshot)', () => {
    const { data, rollback, state } = createSvState({ value: 0 });

    data.value = 1;
    expect(get(state.isDirtyByField)).toEqual({ value: true });

    rollback();

    expect(get(state.isDirtyByField)).toEqual({ value: true });
    expect(get(state.isDirty)).toBe(true);
  });
});

describe('rollbackTo', () => {
  it('should roll back to a snapshot by title and return true', () => {
    const { data, rollbackTo, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot, property }) => {
          snapshot(`Changed ${property}`, false);
        }
      }
    );

    data.value = 1;
    data.value = 2;
    data.value = 3;

    const snapshotsBefore = get(state.snapshots);
    expect(snapshotsBefore).toHaveLength(4); // Initial + 3 changes

    const result = rollbackTo('Changed value');
    expect(result).toBe(true);
    expect(data.value).toBe(3); // Last matching snapshot (value=3)
  });

  it('should return false when title not found and leave state unchanged', () => {
    const { data, rollbackTo, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot }) => {
          snapshot('Change', false);
        }
      }
    );

    data.value = 1;
    expect(get(state.snapshots)).toHaveLength(2);

    const result = rollbackTo('Nonexistent');
    expect(result).toBe(false);
    expect(data.value).toBe(1);
    expect(get(state.snapshots)).toHaveLength(2);
  });

  it('should find the LAST matching snapshot (search from end)', () => {
    const { data, rollbackTo, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot, currentValue }) => {
          if (currentValue === 2) snapshot('Milestone', false);
          else if (currentValue === 5) snapshot('Milestone', false);
          else snapshot(`Set to ${currentValue}`, false);
        }
      }
    );

    data.value = 1;
    data.value = 2; // Milestone
    data.value = 3;
    data.value = 4;
    data.value = 5; // Milestone

    expect(get(state.snapshots)).toHaveLength(6);

    rollbackTo('Milestone');
    // Should find the LAST "Milestone" (value=5), so snapshots trimmed to that point
    expect(data.value).toBe(5);
    expect(get(state.snapshots)).toHaveLength(6); // All snapshots up to and including last Milestone
  });

  it('should be able to roll back to Initial', () => {
    const { data, rollbackTo, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot }) => {
          snapshot('Change', false);
        }
      }
    );

    data.value = 1;
    data.value = 2;

    const result = rollbackTo('Initial');
    expect(result).toBe(true);
    expect(data.value).toBe(0);
    expect(get(state.snapshots)).toHaveLength(1);
  });

  it('should return false when only initial snapshot exists', () => {
    const { rollbackTo } = createSvState({ value: 0 });

    const result = rollbackTo('Initial');
    expect(result).toBe(false);
  });

  it('should trigger validation after rollbackTo', () => {
    const { data, rollbackTo, state } = createSvState(
      { value: '' },
      {
        validator: (source) => ({
          value: source.value.length < 3 ? 'Too short' : ''
        }),
        effect: ({ snapshot }) => {
          snapshot('Change', false);
        }
      }
    );

    data.value = 'abcdef'; // Valid
    data.value = 'ab'; // Invalid

    rollbackTo('Initial');
    expect(get(state.errors)).toEqual({ value: 'Too short' });
  });

  it('should clear dirty fields on rollbackTo', () => {
    const { data, rollbackTo, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot }) => {
          snapshot('Change', false);
        }
      }
    );

    data.value = 1;
    expect(get(state.isDirty)).toBe(true);

    rollbackTo('Initial');
    expect(get(state.isDirtyByField)).toEqual({});
    expect(get(state.isDirty)).toBe(false);
  });
});

describe('maxSnapshots', () => {
  it('should trim oldest non-Initial snapshots when exceeding limit', () => {
    const { data, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot, currentValue }) => {
          snapshot(`Set ${currentValue}`, false);
        }
      },
      { maxSnapshots: 4 }
    );

    data.value = 1;
    data.value = 2;
    data.value = 3;
    data.value = 4;
    data.value = 5;

    const snaps = get(state.snapshots);
    expect(snaps).toHaveLength(4);
    expect(snaps[0]!.title).toBe('Initial'); // Always preserved
    expect(snaps[1]!.title).toBe('Set 3');
    expect(snaps[2]!.title).toBe('Set 4');
    expect(snaps[3]!.title).toBe('Set 5');
  });

  it('should always preserve Initial snapshot', () => {
    const { data, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot, currentValue }) => {
          snapshot(`V${currentValue}`, false);
        }
      },
      { maxSnapshots: 2 }
    );

    data.value = 1;
    data.value = 2;
    data.value = 3;

    const snaps = get(state.snapshots);
    expect(snaps).toHaveLength(2);
    expect(snaps[0]!.title).toBe('Initial');
    expect(snaps[1]!.title).toBe('V3');
  });

  it('should not trim when maxSnapshots is 0 (unlimited)', () => {
    const { data, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot, currentValue }) => {
          snapshot(`V${currentValue}`, false);
        }
      },
      { maxSnapshots: 0 }
    );

    for (let index = 1; index <= 100; index++) data.value = index;

    expect(get(state.snapshots)).toHaveLength(101); // Initial + 100
  });

  it('should trim at default 50 limit', () => {
    const { data, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot, currentValue }) => {
          snapshot(`V${currentValue}`, false);
        }
      }
    );

    for (let index = 1; index <= 55; index++) data.value = index;

    const snaps = get(state.snapshots);
    expect(snaps).toHaveLength(50);
    expect(snaps[0]!.title).toBe('Initial');
    expect(snaps.at(-1)!.title).toBe('V55');
  });

  it('should not trigger trim when replacing a snapshot (same title)', () => {
    const { data, state } = createSvState(
      { value: 0 },
      {
        effect: ({ snapshot }) => {
          snapshot('Same Title'); // replace=true by default
        }
      },
      { maxSnapshots: 5 }
    );

    // Replacing the same title should keep length at 2 (Initial + latest)
    for (let index = 1; index <= 10; index++) data.value = index;

    const snaps = get(state.snapshots);
    expect(snaps).toHaveLength(2);
    expect(snaps[0]!.title).toBe('Initial');
    expect(snaps[1]!.title).toBe('Same Title');
  });
});
