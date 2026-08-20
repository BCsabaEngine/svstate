import { syncPlugin } from '../src/plugins/sync';
import { createSvState } from '../src/state.svelte';

// Mock BroadcastChannel
class MockBroadcastChannel {
  static channels = new Map<string, MockBroadcastChannel[]>();

  static reset() {
    this.channels.clear();
  }

  private listeners: ((event: MessageEvent) => void)[] = [];
  name: string;

  constructor(name: string) {
    this.name = name;
    const list = MockBroadcastChannel.channels.get(name) ?? [];
    list.push(this);
    MockBroadcastChannel.channels.set(name, list);
  }

  addEventListener(_type: string, handler: (event: MessageEvent) => void) {
    this.listeners.push(handler);
  }

  postMessage(data: unknown) {
    const channels = MockBroadcastChannel.channels.get(this.name) ?? [];
    for (const ch of channels)
      if (ch !== this) for (const listener of ch.listeners) listener(new MessageEvent('message', { data }));
  }

  close() {
    const list = MockBroadcastChannel.channels.get(this.name);
    if (list) {
      const index = list.indexOf(this);
      if (index !== -1) list.splice(index, 1);
    }
    this.listeners = [];
  }
}

describe('syncPlugin', () => {
  beforeEach(() => {
    MockBroadcastChannel.reset();
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should broadcast changes to other tabs', async () => {
    const sync1 = syncPlugin({ key: 'test', throttle: 10 });
    const sync2 = syncPlugin({ key: 'test', throttle: 10 });

    const state1 = createSvState({ name: 'initial' }, undefined, { plugins: [sync1] });
    const state2 = createSvState({ name: 'initial' }, undefined, { plugins: [sync2] });

    state1.data.name = 'updated';
    await new Promise((r) => setTimeout(r, 50));

    expect(state2.data.name).toBe('updated');
  });

  it('should reject an incoming payload nested deeper than the depth limit', async () => {
    const sync1 = syncPlugin({ key: 'depth-test', throttle: 10 });
    const sync2 = syncPlugin({ key: 'depth-test', throttle: 10 });

    const state1 = createSvState({ deep: 'unset' as unknown }, undefined, { plugins: [sync1] });
    const state2 = createSvState({ deep: 'unset' as unknown }, undefined, { plugins: [sync2] });

    // 12 levels of object nesting inside "deep" pushes the whole payload past the 10-level limit
    let tooDeep: unknown = 'leaf';
    for (let index = 0; index < 12; index++) tooDeep = { nested: tooDeep };

    state1.data.deep = tooDeep;
    await new Promise((r) => setTimeout(r, 40));

    expect(state2.data.deep).toBe('unset');
  });

  it('should not create echo loops', async () => {
    const sync1 = syncPlugin({ key: 'echo-test', throttle: 10 });
    const sync2 = syncPlugin({ key: 'echo-test', throttle: 10 });

    const state1 = createSvState({ name: 'initial', count: 0 }, undefined, { plugins: [sync1] });
    createSvState({ name: 'initial', count: 0 }, undefined, { plugins: [sync2] });

    state1.data.name = 'changed';
    await new Promise((r) => setTimeout(r, 100));

    // Should settle without infinite loop
    expect(state1.data.name).toBe('changed');
  });

  it('should respect merge ignore', async () => {
    const sync1 = syncPlugin({ key: 'ignore-test', throttle: 10 });
    const sync2 = syncPlugin({ key: 'ignore-test', throttle: 10, merge: 'ignore' });

    const state1 = createSvState({ name: 'initial' }, undefined, { plugins: [sync1] });
    const state2 = createSvState({ name: 'initial' }, undefined, { plugins: [sync2] });

    state1.data.name = 'updated';
    await new Promise((r) => setTimeout(r, 50));

    expect(state2.data.name).toBe('initial');
  });

  it('should disconnect when disconnect is called', async () => {
    const sync1 = syncPlugin({ key: 'disc-test', throttle: 10 });
    const sync2 = syncPlugin({ key: 'disc-test', throttle: 10 });

    const state1 = createSvState({ name: 'initial' }, undefined, { plugins: [sync1] });
    const state2 = createSvState({ name: 'initial' }, undefined, { plugins: [sync2] });

    sync2.disconnect();

    state1.data.name = 'updated';
    await new Promise((r) => setTimeout(r, 50));

    expect(state2.data.name).toBe('initial');
  });

  it('should close channel on destroy', () => {
    const sync = syncPlugin({ key: 'destroy-test', throttle: 10 });
    const { destroy } = createSvState({ name: 'initial' }, undefined, { plugins: [sync] });

    destroy();

    const channels = MockBroadcastChannel.channels.get('destroy-test');
    expect(channels?.length ?? 0).toBe(0);
  });
});

describe('syncPlugin inbound throttling', () => {
  beforeEach(() => {
    MockBroadcastChannel.reset();
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should apply the newest payload of a burst instead of dropping it', async () => {
    const receiver = syncPlugin({ key: 'burst', throttle: 30 });
    const state = createSvState({ name: 'initial' }, undefined, { plugins: [receiver] });

    const sender = new MockBroadcastChannel('burst');
    sender.postMessage({ type: 'sync', data: { name: 'first' } });
    sender.postMessage({ type: 'sync', data: { name: 'second' } });
    sender.postMessage({ type: 'sync', data: { name: 'third' } });

    await new Promise((r) => setTimeout(r, 80));

    expect(state.data.name).toBe('third');
  });

  it('should route an unserializable broadcast to onError', async () => {
    const errors: unknown[] = [];
    const sync = syncPlugin({
      key: 'unserializable',
      throttle: 10,
      onError: (error) => {
        errors.push(error);
      }
    });
    const { data } = createSvState<{ name: string; big: unknown }, never, never>(
      { name: 'a', big: undefined },
      undefined,
      { plugins: [sync] }
    );

    // BigInt is not JSON-serializable — JSON.stringify throws inside the debounced broadcast
    data.big = 1n;

    await new Promise((r) => setTimeout(r, 40));

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(TypeError);
  });

  it('should route a circular structure to onError', async () => {
    const errors: unknown[] = [];
    const sync = syncPlugin({
      key: 'circular',
      throttle: 10,
      onError: (error) => {
        errors.push(error);
      }
    });
    const { data } = createSvState<{ name: string; self: unknown }, never, never>(
      { name: 'a', self: undefined },
      undefined,
      { plugins: [sync] }
    );

    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    data.self = cycle;

    await new Promise((r) => setTimeout(r, 40));

    expect(errors).toHaveLength(1);
  });

  it('should stay a safe no-op when BroadcastChannel is unavailable', async () => {
    vi.stubGlobal('BroadcastChannel', undefined);

    const sync = syncPlugin({ key: 'no-bc', throttle: 10 });
    const { data, destroy } = createSvState({ name: 'initial' }, undefined, { plugins: [sync] });

    data.name = 'updated';
    // Let the throttled broadcast actually fire with no channel to post through, instead of
    // cancelling it via an immediate destroy()
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(() => destroy()).not.toThrow();
  });

  it('should ignore a non-sync message and a non-object payload', async () => {
    const sync1 = syncPlugin({ key: 'ignore-test', throttle: 10 });
    const sync2 = syncPlugin({ key: 'ignore-test', throttle: 10 });

    const state1 = createSvState({ name: 'initial' }, undefined, { plugins: [sync1] });
    const state2 = createSvState({ name: 'initial' }, undefined, { plugins: [sync2] });

    const channel = MockBroadcastChannel.channels.get('ignore-test')![0]!;
    channel.postMessage({ type: 'not-sync', data: { name: 'should-not-apply' } });
    channel.postMessage({ type: 'sync', data: 'not-an-object' });

    await new Promise((r) => setTimeout(r, 30));

    expect(state1.data.name).toBe('initial');
    expect(state2.data.name).toBe('initial');
  });
});
