import { historyPlugin } from '../src/plugins/history';
import { createSvState } from '../src/state.svelte';

// Mock window.location and history
const mockUrl = { search: '', href: 'http://localhost/' };
const pushStateCalls: unknown[] = [];
const replaceStateCalls: unknown[] = [];
const popstateListeners: (() => void)[] = [];

describe('historyPlugin', () => {
  beforeEach(() => {
    mockUrl.search = '';
    mockUrl.href = 'http://localhost/';
    pushStateCalls.length = 0;
    replaceStateCalls.length = 0;
    popstateListeners.length = 0;

    // Mock window
    Object.defineProperty(globalThis, 'window', {
      value: {
        location: {
          get search() {
            return mockUrl.search;
          },
          get href() {
            return mockUrl.href;
          }
        },
        history: {
          pushState: (...arguments_: unknown[]) => {
            pushStateCalls.push(arguments_);
            // Parse the URL to update mockUrl
            const url = arguments_[2] as string;
            if (url) {
              const parsed = new URL(url);
              mockUrl.search = parsed.search;
              mockUrl.href = url;
            }
          },
          replaceState: (...arguments_: unknown[]) => {
            replaceStateCalls.push(arguments_);
            const url = arguments_[2] as string;
            if (url) {
              const parsed = new URL(url);
              mockUrl.search = parsed.search;
              mockUrl.href = url;
            }
          }
        },
        addEventListener: (_event: string, handler: () => void) => {
          popstateListeners.push(handler);
        },
        removeEventListener: (_event: string, handler: () => void) => {
          const index = popstateListeners.indexOf(handler);
          if (index !== -1) popstateListeners.splice(index, 1);
        }
      },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
  });

  it('should read URL params on init', () => {
    mockUrl.search = '?q=hello';
    mockUrl.href = 'http://localhost/?q=hello';

    const history = historyPlugin({ fields: { query: 'q' } });
    const { data } = createSvState({ query: '' }, undefined, { plugins: [history] });

    expect(data.query).toBe('hello');
  });

  it('should update URL on field change with replace mode', () => {
    const history = historyPlugin({ fields: { query: 'q' }, mode: 'replace' });
    const { data } = createSvState({ query: '' }, undefined, { plugins: [history] });

    data.query = 'search-term';

    expect(replaceStateCalls.length).toBe(1);
    expect((replaceStateCalls[0] as unknown[])[2]).toContain('q=search-term');
  });

  it('should update URL on field change with push mode', () => {
    const history = historyPlugin({ fields: { query: 'q' }, mode: 'push' });
    const { data } = createSvState({ query: '' }, undefined, { plugins: [history] });

    data.query = 'search-term';

    expect(pushStateCalls.length).toBe(1);
    expect((pushStateCalls[0] as unknown[])[2]).toContain('q=search-term');
  });

  it('should handle popstate events', () => {
    const history = historyPlugin({ fields: { query: 'q' } });
    const { data } = createSvState({ query: '' }, undefined, { plugins: [history] });

    // Simulate popstate by updating URL and firing listener
    mockUrl.search = '?q=from-back';
    mockUrl.href = 'http://localhost/?q=from-back';
    for (const listener of popstateListeners) listener();

    expect(data.query).toBe('from-back');
  });

  it('should use custom serialize/deserialize', () => {
    const history = historyPlugin({
      fields: { count: 'c' },
      serialize: String,
      deserialize: Number
    });

    mockUrl.search = '?c=42';
    mockUrl.href = 'http://localhost/?c=42';

    const { data } = createSvState({ count: 0 }, undefined, { plugins: [history] });

    expect(data.count).toBe(42);

    data.count = 100;
    const lastCall = replaceStateCalls.at(-1) as unknown[];
    const url = lastCall[2] as string;
    expect(url).toContain('c=100');
  });

  it('should syncFromUrl manually', () => {
    const history = historyPlugin({ fields: { query: 'q' } });
    const { data } = createSvState({ query: '' }, undefined, { plugins: [history] });

    mockUrl.search = '?q=manual';
    mockUrl.href = 'http://localhost/?q=manual';
    history.syncFromUrl();

    expect(data.query).toBe('manual');
  });

  it('should remove popstate listener on destroy', () => {
    const history = historyPlugin({ fields: { query: 'q' } });
    const { destroy } = createSvState({ query: '' }, undefined, { plugins: [history] });

    expect(popstateListeners.length).toBe(1);
    destroy();
    expect(popstateListeners.length).toBe(0);
  });

  it('should stay a safe no-op during SSR, where window is unavailable', () => {
    // Undo the beforeEach mock: neither onInit's URL read nor onChange's URL write may touch it
    delete (globalThis as Record<string, unknown>).window;

    const history = historyPlugin({ fields: { query: 'q' } });

    expect(() => {
      const { data, destroy } = createSvState({ query: 'initial' }, undefined, { plugins: [history] });
      expect(data.query).toBe('initial');

      data.query = 'changed';
      expect(data.query).toBe('changed');

      destroy();
    }).not.toThrow();
  });

  describe('nested fields', () => {
    it('should update URL when a dotted field is mutated directly', () => {
      const history = historyPlugin({ fields: { 'filters.q': 'q' } });
      const { data } = createSvState({ filters: { q: '' } }, undefined, { plugins: [history] });

      data.filters.q = 'nested';

      expect(replaceStateCalls.length).toBe(1);
      expect((replaceStateCalls[0] as unknown[])[2]).toContain('q=nested');
    });

    it('should update URL when the parent of a dotted field is replaced', () => {
      const history = historyPlugin({ fields: { 'filters.q': 'q' } });
      const { data } = createSvState({ filters: { q: '' } }, undefined, { plugins: [history] });

      data.filters = { q: 'replaced' };

      expect(replaceStateCalls.length).toBe(1);
      expect((replaceStateCalls[0] as unknown[])[2]).toContain('q=replaced');
    });

    it('should update URL for a registered parent when a child changes', () => {
      const history = historyPlugin({
        fields: { filters: 'f' },
        serialize: (value) => JSON.stringify(value)
      });
      const { data } = createSvState({ filters: { q: '' } }, undefined, { plugins: [history] });

      data.filters.q = 'child';

      expect(replaceStateCalls.length).toBe(1);
      expect((replaceStateCalls[0] as unknown[])[2]).toContain('child');
    });

    it('should read a dotted field from the URL on init', () => {
      mockUrl.search = '?q=fromurl';
      mockUrl.href = 'http://localhost/?q=fromurl';

      const history = historyPlugin({ fields: { 'filters.q': 'q' } });
      const { data } = createSvState({ filters: { q: '' } }, undefined, { plugins: [history] });

      expect(data.filters.q).toBe('fromurl');
    });
  });

  describe('onError', () => {
    it('should route a throwing serialize to onError instead of escaping', () => {
      const errors: unknown[] = [];
      const history = historyPlugin({
        fields: { query: 'q' },
        serialize: () => {
          throw new Error('serialize failed');
        },
        onError: (error) => {
          errors.push(error);
        }
      });
      const { data } = createSvState({ query: '' }, undefined, { plugins: [history] });

      expect(() => (data.query = 'boom')).not.toThrow();
      expect(errors.length).toBe(1);
      expect((errors[0] as Error).message).toBe('serialize failed');
      expect(replaceStateCalls.length).toBe(0);
    });

    it('should route a throwing deserialize to onError and keep other fields', () => {
      mockUrl.search = '?a=1&b=2';
      mockUrl.href = 'http://localhost/?a=1&b=2';

      const errors: unknown[] = [];
      const history = historyPlugin({
        fields: { alpha: 'a', beta: 'b' },
        deserialize: (parameter, field) => {
          if (field === 'alpha') throw new Error('deserialize failed');
          return parameter;
        },
        onError: (error) => {
          errors.push(error);
        }
      });
      const { data } = createSvState({ alpha: '', beta: '' }, undefined, { plugins: [history] });

      expect(errors.length).toBe(1);
      expect(data.alpha).toBe('');
      expect(data.beta).toBe('2');
    });
  });
});

describe('historyPlugin - errors, nesting and teardown', () => {
  const url = { search: '', href: 'http://localhost/' };
  const listeners: (() => void)[] = [];
  const replaced: string[] = [];

  beforeEach(() => {
    url.search = '';
    url.href = 'http://localhost/';
    listeners.length = 0;
    replaced.length = 0;
    Object.defineProperty(globalThis, 'window', {
      value: {
        location: {
          get search() {
            return url.search;
          },
          get href() {
            return url.href;
          }
        },
        history: {
          pushState: () => {},
          replaceState: (_state: unknown, _title: string, next: string) => {
            replaced.push(next);
            url.href = next;
            url.search = new URL(next).search;
          }
        },
        addEventListener: (_event: string, handler: () => void) => void listeners.push(handler),
        removeEventListener: (_event: string, handler: () => void) => {
          const index = listeners.indexOf(handler);
          if (index !== -1) listeners.splice(index, 1);
        }
      },
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
  });

  it('keeps applying the other fields when a deserializer throws', () => {
    url.search = '?a=1&b=2';
    url.href = 'http://localhost/?a=1&b=2';
    const errors: unknown[] = [];
    const { data } = createSvState({ a: 'x', b: 'y' }, undefined, {
      plugins: [
        historyPlugin({
          fields: { a: 'a', b: 'b' },
          deserialize: (parameter, field) => {
            if (field === 'a') throw new Error('bad a');
            return parameter;
          },
          onError: (error) => void errors.push(error)
        })
      ]
    });

    expect(data.a).toBe('x');
    expect(data.b).toBe('2');
    expect(errors.length).toBe(1);
  });

  it('leaves the URL alone and reports when serialize throws', () => {
    const errors: unknown[] = [];
    const { data } = createSvState({ a: 'x' }, undefined, {
      plugins: [
        historyPlugin({
          fields: { a: 'a' },
          serialize: () => {
            throw new Error('bad serialize');
          },
          onError: (error) => void errors.push(error)
        })
      ]
    });

    data.a = 'y';

    expect(replaced).toEqual([]);
    expect(errors.length).toBe(1);
  });

  it('syncs dotted fields both ways and removes empty values from the URL', () => {
    const { data } = createSvState({ filters: { q: '', page: 1 } }, undefined, {
      plugins: [historyPlugin({ fields: { 'filters.q': 'q' } })]
    });

    data.filters.q = 'abc';
    expect(url.search).toBe('?q=abc');

    data.filters = { q: '', page: 2 }; // replacing the parent updates the registered child
    expect(url.search).toBe('');
  });

  it('refuses dangerous field paths and removes its popstate listener on destroy', () => {
    url.search = '?p=polluted';
    url.href = 'http://localhost/?p=polluted';
    const { destroy } = createSvState({ a: 'x' }, undefined, {
      plugins: [historyPlugin({ fields: { '__proto__.polluted': 'p' } })]
    });

    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(listeners.length).toBe(1);
    destroy();
    expect(listeners.length).toBe(0);
  });

  it('does not write the URL when it already matches (reset on a state read from the URL)', () => {
    url.search = '?a=x';
    url.href = 'http://localhost/?a=x';
    const { reset } = createSvState({ a: 'x' }, undefined, { plugins: [historyPlugin({ fields: { a: 'a' } })] });

    reset();

    expect(replaced).toEqual([]);
  });
});
