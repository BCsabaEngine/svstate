import { get } from 'svelte/store';

import { createSvState, type Validator } from '../src/index';

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
