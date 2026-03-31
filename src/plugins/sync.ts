import type { PluginContext, SvStatePlugin } from '../plugin';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const MAX_SYNC_DEPTH = 10;

const isWithinDepthLimit = (value: unknown, depth = 0): boolean => {
  if (depth > MAX_SYNC_DEPTH) return false;
  if (!isPlainObject(value)) return true;
  return Object.values(value).every((v) => isWithinDepthLimit(v, depth + 1));
};

const safeMerge = (target: Record<string, unknown>, source: Record<string, unknown>): void => {
  for (const key of Object.keys(source)) if (!DANGEROUS_KEYS.has(key)) target[key] = source[key];
};

export type SyncOptions = {
  key: string;
  throttle?: number;
  merge?: 'overwrite' | 'ignore';
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
  let pendingTimeout: ReturnType<typeof setTimeout> | undefined;
  let lastReceivedAt = 0;

  const broadcast = () => {
    if (!channel || !context) return;
    // eslint-disable-next-line unicorn/prefer-structured-clone -- structuredClone fails on Svelte reactive proxies
    const cloned = JSON.parse(JSON.stringify(context.data)) as T;
    // eslint-disable-next-line unicorn/require-post-message-target-origin -- BroadcastChannel.postMessage has no targetOrigin
    channel.postMessage({ type: 'sync', data: cloned });
  };

  const scheduleBroadcast = () => {
    clearTimeout(pendingTimeout);
    pendingTimeout = setTimeout(broadcast, throttleMs);
  };

  const closeChannel = () => {
    clearTimeout(pendingTimeout);
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

        const now = Date.now();
        if (now - lastReceivedAt < throttleMs) return;
        lastReceivedAt = now;

        if (!isPlainObject(event.data.data)) return;
        if (!isWithinDepthLimit(event.data.data)) return;

        isReceiving = true;
        safeMerge(context.data as unknown as Record<string, unknown>, event.data.data);
        isReceiving = false;
      });
    },

    onChange() {
      if (isReceiving) return;
      scheduleBroadcast();
    },

    destroy() {
      closeChannel();
    },

    disconnect() {
      closeChannel();
    }
  };
}
