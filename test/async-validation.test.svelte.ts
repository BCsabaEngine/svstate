import { get } from 'svelte/store';

import { createSvState, stringValidator } from '../src/index';

describe('async validation - basic functionality', () => {
  it('should run async validator after sync passes', async () => {
    let asyncValidatorCalled = false;

    const { data, state } = createSvState(
      { username: '' },
      {
        validator: (source) => ({
          username: stringValidator(source.username).required().minLength(3).getError()
        }),
        asyncValidator: {
          username: async (value) => {
            asyncValidatorCalled = true;
            return value === 'taken' ? 'Username already taken' : '';
          }
        }
      },
      { debounceAsyncValidation: 10 }
    );

    // Set valid username
    data.username = 'validuser';
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(asyncValidatorCalled).toBe(true);
    expect(get(state.asyncErrors)).toEqual({ username: '' });
  });

  it('should skip async validator when sync fails', async () => {
    let asyncValidatorCalled = false;

    const { data, state } = createSvState(
      { username: '' },
      {
        validator: (source) => ({
          username: stringValidator(source.username).required().minLength(3).getError()
        }),
        asyncValidator: {
          username: async () => {
            asyncValidatorCalled = true;
            return '';
          }
        }
      },
      { debounceAsyncValidation: 10 }
    );

    // Set invalid username (too short)
    data.username = 'ab';
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(asyncValidatorCalled).toBe(false);
    expect(get(state.hasErrors)).toBe(true);
  });

  it('should return async error when validation fails', async () => {
    const { data, state } = createSvState(
      { username: '' },
      {
        validator: (source) => ({
          username: stringValidator(source.username).required().minLength(3).getError()
        }),
        asyncValidator: {
          username: async (value) => (value === 'taken' ? 'Username already taken' : '')
        }
      },
      { debounceAsyncValidation: 10 }
    );

    data.username = 'taken';
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(get(state.asyncErrors)).toEqual({ username: 'Username already taken' });
    expect(get(state.hasAsyncErrors)).toBe(true);
  });
});

describe('async validation - debouncing', () => {
  it('should debounce rapid changes', async () => {
    let callCount = 0;

    const { data } = createSvState(
      { username: '' },
      {
        asyncValidator: {
          username: async () => {
            callCount++;
            return '';
          }
        }
      },
      { debounceAsyncValidation: 50 }
    );

    // Rapid changes
    data.username = 'a';
    data.username = 'ab';
    data.username = 'abc';
    data.username = 'abcd';
    data.username = 'abcde';

    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should only call once after debounce
    expect(callCount).toBe(1);
  });
});

describe('async validation - cancellation', () => {
  it('should cancel in-flight validation when field changes', async () => {
    let abortedCount = 0;
    let completedCount = 0;

    const { data } = createSvState(
      { username: '' },
      {
        asyncValidator: {
          username: async (_value, _source, signal) => {
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(resolve, 100);
              signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                abortedCount++;
                reject(new DOMException('Aborted', 'AbortError'));
              });
            });
            completedCount++;
            return '';
          }
        }
      },
      { debounceAsyncValidation: 10 }
    );

    data.username = 'first';
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Change while first validation is in progress
    data.username = 'second';
    await new Promise((resolve) => setTimeout(resolve, 200));

    // First should be aborted, second should complete
    expect(abortedCount).toBe(1);
    expect(completedCount).toBe(1);
  });

  it('should provide AbortSignal to async validator', async () => {
    let receivedSignal: AbortSignal | undefined;

    const { data } = createSvState(
      { username: '' },
      {
        asyncValidator: {
          username: async (_value, _source, signal) => {
            receivedSignal = signal;
            return '';
          }
        }
      },
      { debounceAsyncValidation: 10 }
    );

    data.username = 'test';
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(receivedSignal).toBeInstanceOf(AbortSignal);
  });
});

describe('async validation - asyncValidating store', () => {
  it('should update asyncValidating store during validation', async () => {
    const { data, state } = createSvState(
      { username: '' },
      {
        asyncValidator: {
          username: async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return '';
          }
        }
      },
      { debounceAsyncValidation: 10 }
    );

    data.username = 'test';
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Should be validating
    expect(get(state.asyncValidating)).toContain('username');

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should no longer be validating
    expect(get(state.asyncValidating)).not.toContain('username');
  });
});

describe('async validation - hasCombinedErrors', () => {
  it('should be true when only sync errors exist', async () => {
    const { state } = createSvState(
      { username: '' },
      {
        validator: (source) => ({
          username: stringValidator(source.username).required().getError()
        }),
        asyncValidator: {
          username: async () => ''
        }
      }
    );

    expect(get(state.hasErrors)).toBe(true);
    expect(get(state.hasAsyncErrors)).toBe(false);
    expect(get(state.hasCombinedErrors)).toBe(true);
  });

  it('should be true when only async errors exist', async () => {
    const { data, state } = createSvState(
      { username: '' },
      {
        validator: (source) => ({
          username: stringValidator(source.username).required().getError()
        }),
        asyncValidator: {
          username: async (value) => (value === 'taken' ? 'Already taken' : '')
        }
      },
      { debounceAsyncValidation: 10 }
    );

    data.username = 'taken';
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(get(state.hasErrors)).toBe(false);
    expect(get(state.hasAsyncErrors)).toBe(true);
    expect(get(state.hasCombinedErrors)).toBe(true);
  });

  it('should be false when no errors exist', async () => {
    const { data, state } = createSvState(
      { username: '' },
      {
        validator: (source) => ({
          username: stringValidator(source.username).required().getError()
        }),
        asyncValidator: {
          username: async () => ''
        }
      },
      { debounceAsyncValidation: 10 }
    );

    data.username = 'validuser';
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(get(state.hasErrors)).toBe(false);
    expect(get(state.hasAsyncErrors)).toBe(false);
    expect(get(state.hasCombinedErrors)).toBe(false);
  });
});

describe('async validation - rollback and reset', () => {
  it('should clear async errors on rollback', async () => {
    const { data, rollback, state } = createSvState(
      { username: 'initial' },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed');
        },
        asyncValidator: {
          username: async (value) => (value === 'taken' ? 'Already taken' : '')
        }
      },
      { debounceAsyncValidation: 10 }
    );

    data.username = 'taken';
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(get(state.asyncErrors)).toEqual({ username: 'Already taken' });

    rollback();

    expect(get(state.asyncErrors)).toEqual({});
    expect(data.username).toBe('initial');
  });

  it('should clear async errors on reset', async () => {
    const { data, reset, state } = createSvState(
      { username: 'initial' },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed');
        },
        asyncValidator: {
          username: async (value) => (value === 'taken' ? 'Already taken' : '')
        }
      },
      { debounceAsyncValidation: 10 }
    );

    data.username = 'taken';
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(get(state.asyncErrors)).toEqual({ username: 'Already taken' });

    reset();

    expect(get(state.asyncErrors)).toEqual({});
    expect(data.username).toBe('initial');
  });

  it('should cancel in-flight async validation on rollback', async () => {
    let completedCount = 0;

    const { data, rollback, state } = createSvState(
      { username: 'initial' },
      {
        effect: ({ snapshot }) => {
          snapshot('Changed');
        },
        asyncValidator: {
          username: async (_value, _source, signal) => {
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                completedCount++;
                resolve();
              }, 100);
              signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(new DOMException('Aborted', 'AbortError'));
              });
            });
            return '';
          }
        }
      },
      { debounceAsyncValidation: 10 }
    );

    data.username = 'newvalue';
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Rollback while validation is in progress
    rollback();
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(completedCount).toBe(0);
    expect(get(state.asyncValidating)).toEqual([]);
  });
});

describe('async validation - runAsyncValidationOnInit', () => {
  it('should run async validation on init when configured', async () => {
    let asyncValidatorCalled = false;

    createSvState(
      { username: 'testuser' },
      {
        asyncValidator: {
          username: async () => {
            asyncValidatorCalled = true;
            return '';
          }
        }
      },
      { runAsyncValidationOnInit: true, debounceAsyncValidation: 10 }
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(asyncValidatorCalled).toBe(true);
  });

  it('should not run async validation on init by default', async () => {
    let asyncValidatorCalled = false;

    createSvState(
      { username: 'testuser' },
      {
        asyncValidator: {
          username: async () => {
            asyncValidatorCalled = true;
            return '';
          }
        }
      },
      { debounceAsyncValidation: 10 }
    );

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(asyncValidatorCalled).toBe(false);
  });
});

describe('async validation - clearAsyncErrorsOnChange', () => {
  it('should clear async error when field changes by default', async () => {
    const { data, state } = createSvState(
      { username: '' },
      {
        asyncValidator: {
          username: async (value) => (value === 'taken' ? 'Already taken' : '')
        }
      },
      { debounceAsyncValidation: 10 }
    );

    data.username = 'taken';
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(get(state.asyncErrors)).toEqual({ username: 'Already taken' });

    // Change the field
    data.username = 'different';

    // Error should be cleared immediately
    expect(get(state.asyncErrors)).toEqual({});
  });

  it('should keep async error when clearAsyncErrorsOnChange is false', async () => {
    const { data, state } = createSvState(
      { username: '' },
      {
        asyncValidator: {
          username: async (value) => (value === 'taken' ? 'Already taken' : '')
        }
      },
      { debounceAsyncValidation: 10, clearAsyncErrorsOnChange: false }
    );

    data.username = 'taken';
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(get(state.asyncErrors)).toEqual({ username: 'Already taken' });

    // Change the field
    data.username = 'different';

    // Error should still be there
    expect(get(state.asyncErrors)).toEqual({ username: 'Already taken' });

    // Wait for new validation to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Now it should be cleared
    expect(get(state.asyncErrors)).toEqual({ username: '' });
  });
});

describe('async validation - multiple fields', () => {
  it('should handle multiple async validators independently', async () => {
    const callOrder: string[] = [];

    const { data, state } = createSvState(
      { username: '', email: '' },
      {
        asyncValidator: {
          username: async () => {
            await new Promise((resolve) => setTimeout(resolve, 30));
            callOrder.push('username');
            return '';
          },
          email: async () => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            callOrder.push('email');
            return '';
          }
        }
      },
      { debounceAsyncValidation: 10 }
    );

    data.username = 'user';
    data.email = 'user@example.com';
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(callOrder).toEqual(['email', 'username']);
    expect(get(state.asyncValidating)).toEqual([]);
  });

  it('should track multiple fields validating', async () => {
    const { data, state } = createSvState(
      { username: '', email: '' },
      {
        asyncValidator: {
          username: async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return '';
          },
          email: async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return '';
          }
        }
      },
      { debounceAsyncValidation: 10 }
    );

    data.username = 'user';
    data.email = 'user@example.com';
    await new Promise((resolve) => setTimeout(resolve, 30));

    const validating = get(state.asyncValidating);
    expect(validating).toContain('username');
    expect(validating).toContain('email');
  });
});

describe('async validation - nested paths', () => {
  it('should trigger async validator when nested property changes', async () => {
    let asyncValidatorCalled = false;
    let receivedValue: unknown;

    const { data, state } = createSvState(
      { user: { name: '' } },
      {
        asyncValidator: {
          'user.name': async (value) => {
            asyncValidatorCalled = true;
            receivedValue = value;
            return value === 'taken' ? 'Name taken' : '';
          }
        }
      },
      { debounceAsyncValidation: 10 }
    );

    data.user.name = 'testname';
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(asyncValidatorCalled).toBe(true);
    expect(receivedValue).toBe('testname');
    expect(get(state.asyncErrors)).toEqual({ 'user.name': '' });
  });

  it('should trigger async validator when parent property changes', async () => {
    let asyncValidatorCalled = false;

    const { data, state } = createSvState(
      { user: { name: '' } },
      {
        asyncValidator: {
          user: async (value) => {
            asyncValidatorCalled = true;
            const user = value as { name: string };
            return user.name === 'taken' ? 'User invalid' : '';
          }
        }
      },
      { debounceAsyncValidation: 10 }
    );

    data.user.name = 'taken';
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(asyncValidatorCalled).toBe(true);
    expect(get(state.asyncErrors)).toEqual({ user: 'User invalid' });
  });
});

describe('async validation - receives full source', () => {
  it('should receive full state object in async validator', async () => {
    let receivedSource: unknown;

    const { data } = createSvState(
      { username: '', email: '' },
      {
        asyncValidator: {
          username: async (_value, source) => {
            receivedSource = source;
            return '';
          }
        }
      },
      { debounceAsyncValidation: 10 }
    );

    data.email = 'test@example.com';
    data.username = 'testuser';
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(receivedSource).toBeDefined();
    expect((receivedSource as { username: string; email: string }).username).toBe('testuser');
    expect((receivedSource as { username: string; email: string }).email).toBe('test@example.com');
  });
});
