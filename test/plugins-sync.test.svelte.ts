import { syncPlugin } from '../src/plugins/sync';
import { createSvState } from '../src/state.svelte';

// Mock BroadcastChannel
class MockBroadcastChannel {
  static channels = new Map<string, MockBroadcastChannel[]>();
  name: string;
  private listeners: ((event: MessageEvent) => void)[] = [];

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

  static reset() {
    MockBroadcastChannel.channels.clear();
  }
}

describe('syncPlugin', () => {
  beforeEach(() => {
    MockBroadcastChannel.reset();
    (globalThis as Record<string, unknown>).BroadcastChannel = MockBroadcastChannel;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).BroadcastChannel;
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
