import { hasAnyErrors } from '../internal/errors';
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
  redact?: string[];
  onError?: (error: unknown) => void;
};

export type AnalyticsPluginInstance<T extends Record<string, unknown>> = SvStatePlugin<T> & {
  flush(): void;
  eventCount(): number;
};

export function analyticsPlugin<T extends Record<string, unknown>>(
  options: AnalyticsOptions
): AnalyticsPluginInstance<T> {
  const batchSize = options.batchSize ?? 20;
  const flushInterval = options.flushInterval ?? 5000;
  const include = options.include;

  const buffer: AnalyticsEvent[] = [];
  let intervalTimer: ReturnType<typeof setInterval> | undefined;

  const shouldTrack = (type: AnalyticsEvent['type']) => !include || include.includes(type);

  // A redacted path covers everything below it: redact 'user' also redacts 'user.ssn'
  const isRedacted = (property: string) =>
    options.redact?.some((path) => property === path || property.startsWith(path + '.')) ?? false;

  const addEvent = (type: AnalyticsEvent['type'], detail: Record<string, unknown>) => {
    if (!shouldTrack(type)) return;
    buffer.push({ type, timestamp: Date.now(), detail });
    if (buffer.length >= batchSize) doFlush();
  };

  // A failing sink must never take down the state it is observing
  const flushEvents = async (events: AnalyticsEvent[]) => {
    try {
      await options.onFlush(events);
    } catch (error) {
      options.onError?.(error);
    }
  };

  const doFlush = () => {
    if (buffer.length === 0) return;
    const events = buffer.slice();
    buffer.length = 0;
    void flushEvents(events);
  };

  const plugin: AnalyticsPluginInstance<T> = {
    name: 'analytics',

    onInit() {
      if (flushInterval > 0) intervalTimer = setInterval(doFlush, flushInterval);
    },

    onChange(event) {
      const redacted = isRedacted(event.property);
      addEvent('change', {
        property: event.property,
        currentValue: redacted ? '[redacted]' : event.currentValue,
        oldValue: redacted ? '[redacted]' : event.oldValue
      });
    },

    onValidation(errors) {
      addEvent('validation', { hasErrors: hasAnyErrors(errors) });
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
