import type { SvStatePlugin } from '../plugin';

export type AnalyticsEvent = {
  type: 'change' | 'validation' | 'snapshot' | 'action' | 'rollback' | 'reset';
  timestamp: number;
  detail: Record<string, unknown>;
};

export type AnalyticsOptions = {
  onFlush: (events: AnalyticsEvent[]) => void | Promise<void>;
  batchSize?: number;
  flushInterval?: number;
  include?: AnalyticsEvent['type'][];
};

export function analyticsPlugin<T extends Record<string, unknown>>(
  options: AnalyticsOptions
): SvStatePlugin<T> & { flush(): void; eventCount(): number } {
  const batchSize = options.batchSize ?? 20;
  const flushInterval = options.flushInterval ?? 5000;
  const include = options.include;

  const buffer: AnalyticsEvent[] = [];
  let intervalTimer: ReturnType<typeof setInterval> | undefined;

  const shouldTrack = (type: AnalyticsEvent['type']) => !include || include.includes(type);

  const addEvent = (type: AnalyticsEvent['type'], detail: Record<string, unknown>) => {
    if (!shouldTrack(type)) return;
    buffer.push({ type, timestamp: Date.now(), detail });
    if (buffer.length >= batchSize) doFlush();
  };

  const doFlush = () => {
    if (buffer.length === 0) return;
    const events = buffer.splice(0);
    options.onFlush(events);
  };

  const plugin: SvStatePlugin<T> & { flush(): void; eventCount(): number } = {
    name: 'analytics',

    onInit() {
      if (flushInterval > 0) intervalTimer = setInterval(doFlush, flushInterval);
    },

    onChange(event) {
      addEvent('change', { property: event.property, currentValue: event.currentValue, oldValue: event.oldValue });
    },

    onValidation(errors) {
      addEvent('validation', { hasErrors: errors !== undefined });
    },

    onSnapshot(snapshot) {
      addEvent('snapshot', { title: snapshot.title });
    },

    onAction(event) {
      addEvent('action', { phase: event.phase, error: event.error?.message });
    },

    onRollback(snapshot) {
      addEvent('rollback', { title: snapshot.title });
    },

    onReset() {
      addEvent('reset', {});
    },

    destroy() {
      if (intervalTimer !== undefined) clearInterval(intervalTimer);
      doFlush();
    },

    flush() {
      doFlush();
    },

    eventCount() {
      return buffer.length;
    }
  };

  return plugin;
}
