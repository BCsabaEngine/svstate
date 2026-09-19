import { type AnalyticsEvent, analyticsPlugin } from '../src/plugins/analytics';
import { createSvState } from '../src/state.svelte';

describe('analyticsPlugin', () => {
  it('should buffer events and flush at batch size', () => {
    const flushed: AnalyticsEvent[][] = [];
    const analytics = analyticsPlugin({
      onFlush: (events) => {
        flushed.push([...events]);
      },
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
      onFlush: (events) => {
        flushed.push([...events]);
      },
      batchSize: 100,
      flushInterval: 50
    });
    const { data, destroy } = createSvState({ name: 'test' }, undefined, { plugins: [analytics] });

    data.name = 'updated';
    await new Promise((r) => setTimeout(r, 100));
    destroy();

    expect(flushed.length).toBeGreaterThanOrEqual(1);
  });

  it('should use the default 5000ms flush interval when not specified', () => {
    vi.useFakeTimers();
    try {
      const flushed: AnalyticsEvent[][] = [];
      const analytics = analyticsPlugin({
        onFlush: (events) => {
          flushed.push([...events]);
        },
        batchSize: 100
      });
      const { data, destroy } = createSvState({ name: 'test' }, undefined, { plugins: [analytics] });

      data.name = 'updated';
      expect(flushed.length).toBe(0);

      vi.advanceTimersByTime(5000);
      expect(flushed.length).toBe(1);

      destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should filter by include types', () => {
    const flushed: AnalyticsEvent[][] = [];
    const analytics = analyticsPlugin({
      onFlush: (events) => {
        flushed.push([...events]);
      },
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
      onFlush: (events) => {
        flushed.push([...events]);
      },
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
      onFlush: (events) => {
        flushed.push([...events]);
      },
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
      onFlush: (events) => {
        flushed.push([...events]);
      },
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
      onFlush: (events) => {
        flushed.push([...events]);
      },
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
      onFlush: (events) => {
        flushed.push([...events]);
      },
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

describe('analyticsPlugin validation and redaction', () => {
  it('should report hasErrors false when validation is clean', () => {
    const flushed: AnalyticsEvent[] = [];
    const analytics = analyticsPlugin({
      onFlush: (events) => {
        flushed.push(...events);
      },
      include: ['validation'],
      flushInterval: 0
    });

    createSvState(
      { name: 'ok' },
      { validator: (source) => ({ name: source.name ? '' : 'Required' }) },
      {
        plugins: [analytics]
      }
    );
    analytics.flush();

    expect(flushed).toHaveLength(1);
    expect(flushed[0]?.detail['hasErrors']).toBe(false);
  });

  it('should report hasErrors true when validation fails', () => {
    const flushed: AnalyticsEvent[] = [];
    const analytics = analyticsPlugin({
      onFlush: (events) => {
        flushed.push(...events);
      },
      include: ['validation'],
      flushInterval: 0
    });

    createSvState(
      { name: '' },
      { validator: (source) => ({ name: source.name ? '' : 'Required' }) },
      {
        plugins: [analytics]
      }
    );
    analytics.flush();

    expect(flushed[0]?.detail['hasErrors']).toBe(true);
  });

  it('should redact nested paths under a redacted parent', () => {
    const flushed: AnalyticsEvent[] = [];
    const analytics = analyticsPlugin({
      onFlush: (events) => {
        flushed.push(...events);
      },
      include: ['change'],
      redact: ['user'],
      flushInterval: 0
    });

    const { data } = createSvState({ user: { ssn: '', nickname: '' } }, {}, { plugins: [analytics] });
    data.user.ssn = '123-45-6789';
    analytics.flush();

    expect(flushed[0]?.detail['property']).toBe('user.ssn');
    expect(flushed[0]?.detail['currentValue']).toBe('[redacted]');
  });

  it('should report a rejected onFlush through onError', async () => {
    const errors: unknown[] = [];
    const analytics = analyticsPlugin({
      onFlush: () => Promise.reject(new Error('network down')),
      onError: (error) => {
        errors.push(error);
      },
      include: ['change'],
      flushInterval: 0
    });

    const { data } = createSvState({ value: 0 }, {}, { plugins: [analytics] });
    data.value = 1;
    analytics.flush();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe('network down');
  });
});

describe('analyticsPlugin - failures, teardown and redaction', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports a throwing or rejecting onFlush through onError without touching the state', async () => {
    const errors: unknown[] = [];
    let mode: 'throw' | 'reject' = 'throw';
    const analytics = analyticsPlugin({
      onFlush: () => {
        if (mode === 'throw') throw new Error('sync failure');
        return Promise.reject(new Error('async failure'));
      },
      batchSize: 1,
      flushInterval: 0,
      include: ['change'],
      onError: (error) => void errors.push((error as Error).message)
    });
    const { data } = createSvState({ name: 'a' }, undefined, { plugins: [analytics] });

    data.name = 'b';
    mode = 'reject';
    data.name = 'c';
    await Promise.resolve();
    await Promise.resolve();

    expect(data.name).toBe('c');
    expect(errors).toEqual(['sync failure', 'async failure']);
  });

  it('flushes on destroy, stops the interval and keeps working without onError', () => {
    vi.useFakeTimers();
    const flushed: number[] = [];
    const analytics = analyticsPlugin({
      onFlush: (events) => void flushed.push(events.length),
      batchSize: 100,
      flushInterval: 1000,
      include: ['change']
    });
    const { data, destroy } = createSvState({ name: 'a' }, undefined, { plugins: [analytics] });

    data.name = 'b';
    expect(analytics.eventCount()).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(flushed).toEqual([1]);

    data.name = 'c';
    destroy();
    expect(flushed).toEqual([1, 1]);

    data.name = 'd'; // ignored after destroy
    vi.advanceTimersByTime(5000);
    expect(flushed).toEqual([1, 1]);
  });

  it('does not flush an empty buffer', () => {
    const onFlush = vi.fn();
    const analytics = analyticsPlugin({ onFlush, flushInterval: 0 });
    createSvState({ name: 'a' }, undefined, { plugins: [analytics] });

    analytics.flush();

    expect(onFlush).not.toHaveBeenCalled();
  });

  it('masks a redacted key inside an object pushed to an array, for old and new values', () => {
    const flushed: Record<string, unknown>[] = [];
    const analytics = analyticsPlugin({
      onFlush: (events) => void flushed.push(...events.map((event) => event.detail)),
      redact: ['items.secret'],
      include: ['change'],
      flushInterval: 0
    });
    const { data } = createSvState({ items: [] as { name: string; secret: string }[] }, undefined, {
      plugins: [analytics]
    });

    data.items.push({ name: 'a', secret: 's3cret' });
    analytics.flush();

    expect(flushed).toHaveLength(1);
    const detail = flushed[0]!;
    expect(detail['property']).toBe('items');
    expect(JSON.stringify(detail)).not.toContain('s3cret');
    expect(detail['currentValue']).toEqual([{ name: 'a', secret: '[redacted]' }]);
    expect(data.items[0]!.secret).toBe('s3cret');
  });

  it('redacts exact paths and paths below them', () => {
    const flushed: Record<string, unknown>[] = [];
    const analytics = analyticsPlugin({
      onFlush: (events) => void flushed.push(...events.map((event) => event.detail)),
      redact: ['user'],
      include: ['change'],
      flushInterval: 0
    });
    const { data } = createSvState({ user: { ssn: '1' }, other: 'x' }, undefined, { plugins: [analytics] });

    data.user.ssn = '2';
    data.other = 'y';
    analytics.flush();

    expect(flushed[0]).toEqual({ property: 'user.ssn', currentValue: '[redacted]', oldValue: '[redacted]' });
    expect(flushed[1]).toEqual({ property: 'other', currentValue: 'y', oldValue: 'x' });
  });
});
