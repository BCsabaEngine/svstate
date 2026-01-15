import { get } from 'svelte/store';

import { createSvState } from '../src/index';

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
