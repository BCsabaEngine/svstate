import { get } from 'svelte/store';

import { arrayValidator, createSvState, dateValidator, numberValidator, stringValidator } from '../src/index';

// Centralized thresholds for easy adjustment (in milliseconds)
// Set at 10x expected values to pass in CI/CD pipelines
const THRESHOLDS = {
  // State Creation
  simpleStateCreation: 1,
  largeStateCreation: 5,
  stateWithValidator: 5,
  stateWithEffect: 5,

  // Property Changes
  singleChange: 0.5,
  hundredChanges: 10,
  thousandChanges: 100,
  nestedChanges: 10,

  // Validation
  singleValidation: 1,
  batchedValidation: 1,

  // Snapshots
  smallStateSnapshot: 0.5,
  largeStateSnapshot: 10,
  fiftySnapshots: 10,

  // Rollback
  singleRollback: 1,
  multiStepRollback: 1,
  reset: 1,

  // Validators (higher threshold for first-call JIT compilation overhead)
  stringChain: 0.5,
  numberChain: 0.5,
  arrayChain: 0.5,
  dateChain: 0.5,
  thousandValidatorCalls: 50,

  // Large State
  deeplyNested: 5,
  arrayWithObjects: 5
};

// Helper function to measure execution time
function measureTime(function_: () => void): number {
  const start = performance.now();
  function_();
  return performance.now() - start;
}

// Helper function to measure async execution time
async function measureTimeAsync(function_: () => Promise<void>): Promise<number> {
  const start = performance.now();
  await function_();
  return performance.now() - start;
}

// Helper function to create a large flat state
function createLargeState(count: number): Record<string, string> {
  const state: Record<string, string> = {};
  for (let index = 0; index < count; index++) state[`prop${index}`] = `value${index}`;

  return state;
}

// Helper function to create nested state
function createNestedState(depth: number, breadth: number): Record<string, unknown> {
  if (depth === 0) {
    const leaf: Record<string, string> = {};
    for (let index = 0; index < breadth; index++) leaf[`leaf${index}`] = `value${index}`;

    return leaf;
  }

  const node: Record<string, unknown> = {};
  for (let index = 0; index < breadth; index++) node[`level${depth}_${index}`] = createNestedState(depth - 1, breadth);

  return node;
}

describe('Performance Tests', () => {
  describe('State Creation', () => {
    it('should create simple state quickly', () => {
      const time = measureTime(() => {
        createSvState({ name: 'test', count: 0 });
      });

      expect(time).toBeLessThan(THRESHOLDS.simpleStateCreation);
    });

    it('should create state with 100 properties within threshold', () => {
      const largeState = createLargeState(100);

      const time = measureTime(() => {
        createSvState(largeState);
      });

      expect(time).toBeLessThan(THRESHOLDS.largeStateCreation);
    });

    it('should create state with validator within threshold', () => {
      const time = measureTime(() => {
        createSvState(
          { name: '', email: '' },
          {
            validator: (source) => ({
              name: source.name.length < 2 ? 'Name too short' : '',
              email: source.email.includes('@') ? '' : 'Invalid email'
            })
          }
        );
      });

      expect(time).toBeLessThan(THRESHOLDS.stateWithValidator);
    });

    it('should create state with effect/snapshot within threshold', () => {
      const time = measureTime(() => {
        createSvState(
          { value: 0 },
          {
            effect: ({ snapshot, property }) => {
              snapshot(`Changed ${property}`);
            }
          }
        );
      });

      expect(time).toBeLessThan(THRESHOLDS.stateWithEffect);
    });
  });

  describe('Property Changes', () => {
    it('should handle single property change quickly', () => {
      const { data } = createSvState({ value: 0 });

      const time = measureTime(() => {
        data.value = 1;
      });

      expect(time).toBeLessThan(THRESHOLDS.singleChange);
    });

    it('should handle 100 property changes within threshold', () => {
      const { data } = createSvState({ value: 0 });

      const time = measureTime(() => {
        for (let index = 0; index < 100; index++) data.value = index;
      });

      expect(time).toBeLessThan(THRESHOLDS.hundredChanges);
    });

    it('should handle 1000 property changes within threshold', () => {
      const { data } = createSvState({ value: 0 });

      const time = measureTime(() => {
        for (let index = 0; index < 1000; index++) data.value = index;
      });

      expect(time).toBeLessThan(THRESHOLDS.thousandChanges);
    });

    it('should handle nested property changes within threshold', () => {
      const { data } = createSvState({
        user: {
          profile: {
            name: 'test',
            settings: {
              theme: 'dark'
            }
          }
        }
      });

      const time = measureTime(() => {
        for (let index = 0; index < 100; index++) {
          data.user.profile.name = `name${index}`;
          data.user.profile.settings.theme = index % 2 === 0 ? 'dark' : 'light';
        }
      });

      expect(time).toBeLessThan(THRESHOLDS.nestedChanges);
    });
  });

  describe('Validation', () => {
    it('should execute validation quickly', async () => {
      const { data } = createSvState(
        { name: '' },
        {
          validator: (source) => ({
            name: source.name.length < 2 ? 'Name too short' : ''
          })
        }
      );

      const time = await measureTimeAsync(async () => {
        data.name = 'a';
        // Wait for batched validation to complete
        await new Promise((resolve) => queueMicrotask(resolve));
      });

      expect(time).toBeLessThan(THRESHOLDS.singleValidation);
    });

    it('should batch multiple changes into single validation', async () => {
      let validationCount = 0;
      const { data, state } = createSvState(
        { a: '', b: '', c: '' },
        {
          validator: (source) => {
            validationCount++;
            return {
              a: source.a ? '' : 'Required',
              b: source.b ? '' : 'Required',
              c: source.c ? '' : 'Required'
            };
          }
        }
      );

      // Wait for initial validation
      await new Promise((resolve) => queueMicrotask(resolve));
      const initialCount = validationCount;

      const time = await measureTimeAsync(async () => {
        data.a = 'value1';
        data.b = 'value2';
        data.c = 'value3';
        // Wait for batched validation
        await new Promise((resolve) => queueMicrotask(resolve));
      });

      // Should have batched all changes into one validation call
      expect(validationCount).toBe(initialCount + 1);
      expect(time).toBeLessThan(THRESHOLDS.batchedValidation);
      expect(get(state.hasErrors)).toBe(false);
    });
  });

  describe('Snapshots', () => {
    it('should create snapshot of small state quickly', () => {
      const { data } = createSvState(
        { value: 0 },
        {
          effect: ({ snapshot }) => {
            snapshot('Change');
          }
        }
      );

      const time = measureTime(() => {
        data.value = 1;
      });

      expect(time).toBeLessThan(THRESHOLDS.smallStateSnapshot);
    });

    it('should create snapshot of large state within threshold', () => {
      const largeState = createLargeState(100);
      const { data } = createSvState(largeState, {
        effect: ({ snapshot }) => {
          snapshot('Change');
        }
      });

      const time = measureTime(() => {
        (data as Record<string, string>).prop0 = 'updated';
      });

      expect(time).toBeLessThan(THRESHOLDS.largeStateSnapshot);
    });

    it('should handle 50 snapshots within threshold', () => {
      const { data, state } = createSvState(
        { value: 0 },
        {
          effect: ({ snapshot, currentValue }) => {
            // Use unique title to prevent replacement
            snapshot(`Change to ${currentValue}`);
          }
        }
      );

      const time = measureTime(() => {
        for (let index = 1; index <= 50; index++) data.value = index;
      });

      expect(time).toBeLessThan(THRESHOLDS.fiftySnapshots);
      // Initial + 50 changes
      expect(get(state.snapshots).length).toBe(51);
    });
  });

  describe('Rollback', () => {
    it('should perform single rollback quickly', () => {
      const { data, rollback, state } = createSvState(
        { value: 0 },
        {
          effect: ({ snapshot, currentValue }) => {
            // Use unique titles to prevent replacement
            snapshot(`Change to ${currentValue}`);
          }
        }
      );

      data.value = 1;
      data.value = 2;
      expect(get(state.snapshots).length).toBe(3);

      const time = measureTime(() => {
        rollback();
      });

      expect(time).toBeLessThan(THRESHOLDS.singleRollback);
      expect(data.value).toBe(1);
    });

    it('should perform multi-step rollback quickly', () => {
      const { data, rollback, state } = createSvState(
        { value: 0 },
        {
          effect: ({ snapshot, currentValue }) => {
            snapshot(`Value: ${currentValue}`);
          }
        }
      );

      for (let index = 1; index <= 10; index++) data.value = index;

      expect(get(state.snapshots).length).toBe(11);

      const time = measureTime(() => {
        rollback(5);
      });

      expect(time).toBeLessThan(THRESHOLDS.multiStepRollback);
      expect(data.value).toBe(5);
    });

    it('should perform reset quickly', () => {
      const { data, reset } = createSvState(
        { value: 0 },
        {
          effect: ({ snapshot }) => {
            snapshot('Change');
          }
        }
      );

      for (let index = 1; index <= 20; index++) data.value = index;

      const time = measureTime(() => {
        reset();
      });

      expect(time).toBeLessThan(THRESHOLDS.reset);
      expect(data.value).toBe(0);
    });
  });

  describe('Validator Builders', () => {
    it('should execute string validator chain quickly', () => {
      const time = measureTime(() => {
        stringValidator('  test@example.com  ')
          .prepare('trim')
          .required()
          .minLength(5)
          .maxLength(100)
          .email()
          .getError();
      });

      expect(time).toBeLessThan(THRESHOLDS.stringChain);
    });

    it('should execute number validator chain quickly', () => {
      const time = measureTime(() => {
        numberValidator(42).required().min(0).max(100).integer().positive().getError();
      });

      expect(time).toBeLessThan(THRESHOLDS.numberChain);
    });

    it('should execute array validator chain quickly', () => {
      const time = measureTime(() => {
        arrayValidator([1, 2, 3, 4, 5]).required().minLength(1).maxLength(10).unique().getError();
      });

      expect(time).toBeLessThan(THRESHOLDS.arrayChain);
    });

    it('should execute date validator chain quickly', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 25);

      const time = measureTime(() => {
        dateValidator(pastDate).required().past().minAge(18).maxAge(150).getError();
      });

      expect(time).toBeLessThan(THRESHOLDS.dateChain);
    });

    it('should handle 1000 validator calls within threshold', () => {
      const time = measureTime(() => {
        for (let index = 0; index < 1000; index++)
          stringValidator(`test${index}`).prepare('trim').required().minLength(1).maxLength(100).getError();
      });

      expect(time).toBeLessThan(THRESHOLDS.thousandValidatorCalls);
    });
  });

  describe('Large State Operations', () => {
    it('should handle deeply nested state (4 levels) within threshold', () => {
      const nestedState = createNestedState(4, 3);

      const time = measureTime(() => {
        createSvState(nestedState, {
          effect: ({ snapshot }) => {
            snapshot('Change');
          }
        });
      });

      expect(time).toBeLessThan(THRESHOLDS.deeplyNested);
    });

    it('should handle array with 100 objects within threshold', () => {
      const arrayState = {
        items: Array.from({ length: 100 }, (_, index) => ({
          id: index,
          name: `Item ${index}`,
          details: {
            description: `Description for item ${index}`,
            tags: ['tag1', 'tag2']
          }
        }))
      };

      const time = measureTime(() => {
        const { data } = createSvState(arrayState, {
          effect: ({ snapshot }) => {
            snapshot('Change');
          }
        });

        // Modify some items
        for (let index = 0; index < 10; index++) data.items[index].name = `Updated Item ${index}`;
      });

      expect(time).toBeLessThan(THRESHOLDS.arrayWithObjects);
    });
  });
});
