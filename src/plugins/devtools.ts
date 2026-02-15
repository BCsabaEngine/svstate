import type { SvStatePlugin } from '../plugin';

export type DevtoolsOptions = {
  name?: string;
  collapsed?: boolean;
  logValidation?: boolean;
  enabled?: boolean;
};

const isProduction = (): boolean => {
  try {
    return (import.meta as unknown as Record<string, Record<string, unknown>>)['env']?.['PROD'] === true;
  } catch {
    return false;
  }
};

export function devtoolsPlugin<T extends Record<string, unknown>>(options?: DevtoolsOptions): SvStatePlugin<T> {
  const name = options?.name ?? 'svstate';
  const collapsed = options?.collapsed ?? true;
  const logValidation = options?.logValidation ?? false;
  const enabled = options?.enabled ?? !isProduction();

  const log = (label: string, ...arguments_: unknown[]) => {
    if (!enabled) return;
    const timestamp = new Date().toISOString().slice(11, 23);
    const groupFunction = collapsed ? console.groupCollapsed : console.group;
    groupFunction(`[${name}] ${label} (${timestamp})`);
    for (const argument of arguments_) console.log(argument);
    console.groupEnd();
  };

  return {
    name: 'devtools',

    onChange(event) {
      log('change', { property: event.property, from: event.oldValue, to: event.currentValue });
    },

    onValidation(errors) {
      if (logValidation) log('validation', errors);
    },

    onSnapshot(snapshot) {
      log('snapshot', { title: snapshot.title });
    },

    onAction(event) {
      if (event.error) log(`action:${event.phase}`, { params: event.params, error: event.error.message });
      else log(`action:${event.phase}`, { params: event.params });
    },

    onRollback(snapshot) {
      log('rollback', { title: snapshot.title });
    },

    onReset() {
      log('reset');
    }
  };
}
