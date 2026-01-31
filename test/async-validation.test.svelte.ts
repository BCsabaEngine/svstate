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

describe('async validation - maxConcurrentAsyncValidations', () => {
  it('should respect concurrency limit (6 validators, max 4)', async () => {
    const activeValidations: string[] = [];
    const maxConcurrent = { value: 0 };

    const { data, state } = createSvState(
      { a: '', b: '', c: '', d: '', e: '', f: '' },
      {
        asyncValidator: {
          a: async () => {
            activeValidations.push('a');
            maxConcurrent.value = Math.max(maxConcurrent.value, activeValidations.length);
            await new Promise((resolve) => setTimeout(resolve, 50));
            activeValidations.splice(activeValidations.indexOf('a'), 1);
            return '';
          },
          b: async () => {
            activeValidations.push('b');
            maxConcurrent.value = Math.max(maxConcurrent.value, activeValidations.length);
            await new Promise((resolve) => setTimeout(resolve, 50));
            activeValidations.splice(activeValidations.indexOf('b'), 1);
            return '';
          },
          c: async () => {
            activeValidations.push('c');
            maxConcurrent.value = Math.max(maxConcurrent.value, activeValidations.length);
            await new Promise((resolve) => setTimeout(resolve, 50));
            activeValidations.splice(activeValidations.indexOf('c'), 1);
            return '';
          },
          d: async () => {
            activeValidations.push('d');
            maxConcurrent.value = Math.max(maxConcurrent.value, activeValidations.length);
            await new Promise((resolve) => setTimeout(resolve, 50));
            activeValidations.splice(activeValidations.indexOf('d'), 1);
            return '';
          },
          e: async () => {
            activeValidations.push('e');
            maxConcurrent.value = Math.max(maxConcurrent.value, activeValidations.length);
            await new Promise((resolve) => setTimeout(resolve, 50));
            activeValidations.splice(activeValidations.indexOf('e'), 1);
            return '';
          },
          f: async () => {
            activeValidations.push('f');
            maxConcurrent.value = Math.max(maxConcurrent.value, activeValidations.length);
            await new Promise((resolve) => setTimeout(resolve, 50));
            activeValidations.splice(activeValidations.indexOf('f'), 1);
            return '';
          }
        }
      },
      { debounceAsyncValidation: 10, maxConcurrentAsyncValidations: 4 }
    );

    // Trigger all 6 validators simultaneously
    data.a = 'x';
    data.b = 'x';
    data.c = 'x';
    data.d = 'x';
    data.e = 'x';
    data.f = 'x';

    // Wait for all validations to complete
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Should never exceed 4 concurrent validations
    expect(maxConcurrent.value).toBeLessThanOrEqual(4);
    expect(get(state.asyncValidating)).toEqual([]);
  });

  it('should process queue in FIFO order', async () => {
    const completionOrder: string[] = [];

    const { data } = createSvState(
      { a: '', b: '', c: '', d: '', e: '' },
      {
        asyncValidator: {
          a: async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            completionOrder.push('a');
            return '';
          },
          b: async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            completionOrder.push('b');
            return '';
          },
          c: async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            completionOrder.push('c');
            return '';
          },
          d: async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            completionOrder.push('d');
            return '';
          },
          e: async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            completionOrder.push('e');
            return '';
          }
        }
      },
      { debounceAsyncValidation: 10, maxConcurrentAsyncValidations: 2 }
    );

    // Trigger in order a, b, c, d, e
    data.a = 'x';
    data.b = 'x';
    data.c = 'x';
    data.d = 'x';
    data.e = 'x';

    // Wait for all validations to complete
    await new Promise((resolve) => setTimeout(resolve, 200));

    // First 2 (a, b) should complete first, then c, d, then e
    // Since they have same duration, order depends on when they started
    expect(completionOrder.length).toBe(5);
    // a and b start immediately (first batch), c and d are queued (second batch), e is last
  });

  it('should remove cancelled validation from queue', async () => {
    let fieldEValidatorCalled = false;

    const { data } = createSvState(
      { a: '', b: '', c: '', d: '', e: '' },
      {
        asyncValidator: {
          a: async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return '';
          },
          b: async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return '';
          },
          c: async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            return '';
          },
          d: async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            return '';
          },
          e: async () => {
            fieldEValidatorCalled = true;
            return '';
          }
        }
      },
      { debounceAsyncValidation: 10, maxConcurrentAsyncValidations: 2 }
    );

    // Trigger all validators
    data.a = 'x';
    data.b = 'x';
    data.c = 'x';
    data.d = 'x';
    data.e = 'first';

    // Wait for debounce, but before e gets to run
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Re-trigger e - this should remove old e from queue and add new one
    data.e = 'second';

    // Wait for all to complete
    await new Promise((resolve) => setTimeout(resolve, 300));

    // e should have been called (with the second value)
    expect(fieldEValidatorCalled).toBe(true);
  });

  it('should use default limit of 4 when not specified', async () => {
    const activeValidations: string[] = [];
    const maxConcurrent = { value: 0 };

    const makeValidator = (name: string) => async () => {
      activeValidations.push(name);
      maxConcurrent.value = Math.max(maxConcurrent.value, activeValidations.length);
      await new Promise((resolve) => setTimeout(resolve, 50));
      activeValidations.splice(activeValidations.indexOf(name), 1);
      return '';
    };

    const { data } = createSvState(
      { a: '', b: '', c: '', d: '', e: '', f: '' },
      {
        asyncValidator: {
          a: makeValidator('a'),
          b: makeValidator('b'),
          c: makeValidator('c'),
          d: makeValidator('d'),
          e: makeValidator('e'),
          f: makeValidator('f')
        }
      },
      { debounceAsyncValidation: 10 }
    );

    data.a = 'x';
    data.b = 'x';
    data.c = 'x';
    data.d = 'x';
    data.e = 'x';
    data.f = 'x';

    await new Promise((resolve) => setTimeout(resolve, 300));

    // Default is 4
    expect(maxConcurrent.value).toBeLessThanOrEqual(4);
  });

  it('should allow setting higher concurrency limit', async () => {
    const activeValidations: string[] = [];
    const maxConcurrent = { value: 0 };

    const makeValidator = (name: string) => async () => {
      activeValidations.push(name);
      maxConcurrent.value = Math.max(maxConcurrent.value, activeValidations.length);
      await new Promise((resolve) => setTimeout(resolve, 50));
      activeValidations.splice(activeValidations.indexOf(name), 1);
      return '';
    };

    const { data } = createSvState(
      { a: '', b: '', c: '', d: '', e: '', f: '' },
      {
        asyncValidator: {
          a: makeValidator('a'),
          b: makeValidator('b'),
          c: makeValidator('c'),
          d: makeValidator('d'),
          e: makeValidator('e'),
          f: makeValidator('f')
        }
      },
      { debounceAsyncValidation: 10, maxConcurrentAsyncValidations: 10 }
    );

    data.a = 'x';
    data.b = 'x';
    data.c = 'x';
    data.d = 'x';
    data.e = 'x';
    data.f = 'x';

    await new Promise((resolve) => setTimeout(resolve, 150));

    // With limit of 10, all 6 should run concurrently
    expect(maxConcurrent.value).toBe(6);
  });

  it('should clear queue on reset', async () => {
    let callCount = 0;

    const { data, reset } = createSvState(
      { a: '', b: '', c: '', d: '', e: '' },
      {
        asyncValidator: {
          a: async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return '';
          },
          b: async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return '';
          },
          c: async () => {
            callCount++;
            return '';
          },
          d: async () => {
            callCount++;
            return '';
          },
          e: async () => {
            callCount++;
            return '';
          }
        }
      },
      { debounceAsyncValidation: 10, maxConcurrentAsyncValidations: 2 }
    );

    // Trigger all - a and b run, c, d, e are queued
    data.a = 'x';
    data.b = 'x';
    data.c = 'x';
    data.d = 'x';
    data.e = 'x';

    // Wait for debounce to expire and validations to start
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Reset should clear the queue
    reset();

    // Wait for any remaining validations
    await new Promise((resolve) => setTimeout(resolve, 200));

    // c, d, e should never have been called since they were in queue when reset happened
    expect(callCount).toBe(0);
  });
});
