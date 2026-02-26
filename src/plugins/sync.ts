import type { PluginContext, SvStatePlugin } from '../plugin';

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
        if (event.data?.type === 'sync') {
          isReceiving = true;
          Object.assign(context.data, event.data.data);
          isReceiving = false;
        }
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
