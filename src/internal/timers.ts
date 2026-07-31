// Shared timer helpers used by the plugins.
// Internal module — not part of the public API surface.

export type Debouncer = {
  /** (Re)starts the delay; `run` fires once the delay elapses without another call. */
  schedule(): void;
  /** Drops a pending run without executing it. */
  cancel(): void;
  /** Runs `run` immediately if one is pending, otherwise does nothing. */
  flush(): void;
  isPending(): boolean;
};

/**
 * Trailing-edge debounce: a burst of `schedule()` calls collapses into a single `run`
 * fired `delayMs` after the last one.
 */
export const createDebouncer = (run: () => void, delayMs: number): Debouncer => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const cancel = () => {
    if (timeoutId === undefined) return;
    clearTimeout(timeoutId);
    timeoutId = undefined;
  };

  return {
    schedule() {
      cancel();
      timeoutId = setTimeout(() => {
        timeoutId = undefined;
        run();
      }, delayMs);
    },
    cancel,
    flush() {
      if (timeoutId === undefined) return;
      cancel();
      run();
    },
    isPending: () => timeoutId !== undefined
  };
};
