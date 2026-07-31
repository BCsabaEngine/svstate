import { asRecord, isPlainObject, safeMerge } from '../internal/paths';
import { createDebouncer } from '../internal/timers';
import type { PluginContext, SvStatePlugin } from '../plugin';

const MAX_SYNC_DEPTH = 10;

const isWithinDepthLimit = (value: unknown, depth = 0): boolean => {
  if (depth > MAX_SYNC_DEPTH) return false;
  if (!isPlainObject(value)) return true;
  return Object.values(value).every((v) => isWithinDepthLimit(v, depth + 1));
};

export type SyncOptions = {
  key: string;
  throttle?: number;
  merge?: 'overwrite' | 'ignore';
  onError?: (error: unknown) => void;
};

export type SyncPluginInstance<T extends Record<string, unknown>> = SvStatePlugin<T> & {
  disconnect(): void;
};

export function syncPlugin<T extends Record<string, unknown>>(options: SyncOptions): SyncPluginInstance<T> {
  const throttleMs = options.throttle ?? 100;
  const merge = options.merge ?? 'overwrite';

  let channel: BroadcastChannel | undefined;
  let context: PluginContext<T> | undefined;
  let isReceiving = false;
  let lastReceivedAt = 0;
  let pendingIncoming: Record<string, unknown> | undefined;
  let incomingTimeout: ReturnType<typeof setTimeout> | undefined;

  const broadcast = () => {
    if (!channel || !context) return;
    try {
      // eslint-disable-next-line unicorn/prefer-structured-clone -- structuredClone fails on Svelte reactive proxies
      const cloned = JSON.parse(JSON.stringify(context.data)) as T;

      channel.postMessage({ type: 'sync', data: cloned });
    } catch (error) {
      // Circular structures, BigInt, a closed channel — never throw out of a timer
      options.onError?.(error);
    }
  };

  const broadcaster = createDebouncer(broadcast, throttleMs);

  const applyIncoming = (payload: Record<string, unknown>) => {
    if (!context) return;
    isReceiving = true;
    try {
      safeMerge(asRecord(context.data), payload);
    } finally {
      isReceiving = false;
    }
  };

  // Throttle inbound messages without dropping the newest one: bursts collapse to the last payload,
  // which is applied when the window closes.
  const queueIncoming = (payload: Record<string, unknown>) => {
    const elapsed = Date.now() - lastReceivedAt;
    if (elapsed >= throttleMs) {
      lastReceivedAt = Date.now();
      applyIncoming(payload);
      return;
    }

    pendingIncoming = payload;
    if (incomingTimeout !== undefined) return;
    incomingTimeout = setTimeout(() => {
      incomingTimeout = undefined;
      const next = pendingIncoming;
      pendingIncoming = undefined;
      if (!next) return;
      lastReceivedAt = Date.now();
      applyIncoming(next);
    }, throttleMs - elapsed);
  };

  const closeChannel = () => {
    broadcaster.cancel();
    clearTimeout(incomingTimeout);
    incomingTimeout = undefined;
    pendingIncoming = undefined;
    if (channel) {
      channel.close();
      channel = undefined;
    }
  };

  return {
    name: 'sync',

    onInit(context_) {
      context = context_;
      if (typeof BroadcastChannel === 'undefined') return;

      channel = new BroadcastChannel(options.key);
      channel.addEventListener('message', (event: MessageEvent) => {
        if (!context || merge === 'ignore') return;
        if (event.data?.type !== 'sync') return;

        if (!isPlainObject(event.data.data)) return;
        if (!isWithinDepthLimit(event.data.data)) return;

        queueIncoming(event.data.data);
      });
    },

    onChange() {
      if (isReceiving) return;
      broadcaster.schedule();
    },

    destroy() {
      closeChannel();
    },

    disconnect() {
      closeChannel();
    }
  };
}
