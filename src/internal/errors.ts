import type { Validator } from '../state.svelte';

/** True when any leaf of the (possibly nested) validator result is a non-empty string. */
const hasValidatorErrors = (validator: Validator): boolean =>
  Object.values(validator).some((item) => (typeof item === 'string' ? !!item : hasValidatorErrors(item)));

export const hasAnyErrors = ($errors: Validator | undefined): boolean => !!$errors && hasValidatorErrors($errors);

/**
 * Normalizes anything thrown into an Error. Non-Error objects are unwrapped by reading
 * `.message`, then `.body.message`, before falling back to `String()`.
 */
export const toError = (thrown: unknown): Error => {
  if (thrown instanceof Error) return thrown;
  if (thrown !== null && typeof thrown === 'object') {
    const candidate = thrown as { message?: unknown; body?: { message?: unknown } };
    return new Error(String(candidate.message ?? candidate.body?.message ?? thrown));
  }
  return new Error(String(thrown));
};
