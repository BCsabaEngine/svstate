import { type AnalyticsEvent, analyticsPlugin } from '../src/plugins/analytics';
import { createSvState } from '../src/state.svelte';

describe('analyticsPlugin', () => {
  it('should buffer events and flush at batch size', () => {
    const flushed: AnalyticsEvent[][] = [];
    const analytics = analyticsPlugin({
      onFlush: (events) => flushed.push([...events]),
      batchSize: 3,
      flushInterval: 0
    });
    const { data } = createSvState({ name: 'test', count: 0 }, undefined, { plugins: [analytics] });

    data.name = 'a';
    data.name = 'b';
    data.name = 'c';

    // 3 changes should trigger flush
    expect(flushed.length).toBe(1);
    expect(flushed[0]!.length).toBe(3);
    expect(flushed[0]![0]!.type).toBe('change');
  });

  it('should flush on interval', async () => {
    const flushed: AnalyticsEvent[][] = [];
    const analytics = analyticsPlugin({
      onFlush: (events) => flushed.push([...events]),
      batchSize: 100,
      flushInterval: 50
    });
    const { data, destroy } = createSvState({ name: 'test' }, undefined, { plugins: [analytics] });

    data.name = 'updated';
    await new Promise((r) => setTimeout(r, 100));
    destroy();

    expect(flushed.length).toBeGreaterThanOrEqual(1);
  });

  it('should filter by include types', () => {
    const flushed: AnalyticsEvent[][] = [];
    const analytics = analyticsPlugin({
      onFlush: (events) => flushed.push([...events]),
      batchSize: 100,
      flushInterval: 0,
      include: ['action']
    });
    const { data } = createSvState({ name: 'test' }, undefined, { plugins: [analytics] });

    data.name = 'updated';
    analytics.flush();

    // onChange events should not be tracked
    expect(flushed.length).toBe(0);
    expect(analytics.eventCount()).toBe(0);
  });

  it('should flush remaining on destroy', () => {
    const flushed: AnalyticsEvent[][] = [];
    const analytics = analyticsPlugin({
      onFlush: (events) => flushed.push([...events]),
      batchSize: 100,
      flushInterval: 0
    });
    const { data, destroy } = createSvState({ name: 'test' }, undefined, { plugins: [analytics] });

    data.name = 'updated';
    expect(analytics.eventCount()).toBe(1);

    destroy();
    expect(flushed.length).toBe(1);
    expect(analytics.eventCount()).toBe(0);
  });

  it('should flush all pending with flush()', () => {
    const flushed: AnalyticsEvent[][] = [];
    const analytics = analyticsPlugin({
      onFlush: (events) => flushed.push([...events]),
      batchSize: 100,
      flushInterval: 0
    });
    const { data } = createSvState({ name: 'test' }, undefined, { plugins: [analytics] });

    data.name = 'a';
    data.name = 'b';
    analytics.flush();

    expect(flushed.length).toBe(1);
    expect(flushed[0]!.length).toBe(2);
  });

  it('should track action events', async () => {
    const flushed: AnalyticsEvent[][] = [];
    const analytics = analyticsPlugin({
      onFlush: (events) => flushed.push([...events]),
      batchSize: 100,
      flushInterval: 0
    });
    const { execute } = createSvState({ name: 'test' }, { action: async () => {} }, { plugins: [analytics] });

    await execute();
    analytics.flush();

    const actionEvents = flushed[0]!.filter((event) => event.type === 'action');
    expect(actionEvents.length).toBe(2);
    expect(actionEvents[0]!.detail.phase).toBe('before');
    expect(actionEvents[1]!.detail.phase).toBe('after');
  });

  it('should track rollback and reset events', () => {
    const flushed: AnalyticsEvent[][] = [];
    const analytics = analyticsPlugin({
      onFlush: (events) => flushed.push([...events]),
      batchSize: 100,
      flushInterval: 0
    });
    const { data, rollback, reset } = createSvState(
      { name: 'test' },
      { effect: ({ snapshot }) => snapshot('Change') },
      { plugins: [analytics] }
    );

    data.name = 'updated';
    rollback();
    data.name = 'again';
    reset();

    analytics.flush();

    const types = flushed[0]!.map((event) => event.type);
    expect(types).toContain('rollback');
    expect(types).toContain('reset');
  });

  it('should track snapshot events', () => {
    const flushed: AnalyticsEvent[][] = [];
    const analytics = analyticsPlugin({
      onFlush: (events) => flushed.push([...events]),
      batchSize: 100,
      flushInterval: 0
    });
    const { data } = createSvState(
      { name: 'test' },
      { effect: ({ snapshot }) => snapshot('MySnapshot') },
      { plugins: [analytics] }
    );

    data.name = 'updated';
    analytics.flush();

    const snapshotEvents = flushed[0]!.filter((event) => event.type === 'snapshot');
    expect(snapshotEvents.length).toBe(1);
    expect(snapshotEvents[0]!.detail.title).toBe('MySnapshot');
  });
});
