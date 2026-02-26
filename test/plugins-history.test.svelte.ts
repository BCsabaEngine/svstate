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
});
