type BaseOption = 'trim' | 'normalize';
type PrepareOption = BaseOption | 'upper' | 'lower';

const prepareOps: Record<PrepareOption, (s: string) => string> = {
  trim: (s) => s.trim(),
  normalize: (s) => s.replaceAll(/\s{2,}/g, ' '),
  upper: (s) => s.toLocaleUpperCase(),
  lower: (s) => s.toLocaleLowerCase()
};

// Overloads enforce XOR: only 'upper' OR 'lower' allowed, not both
export function stringValidator(input: string, ...prepares: (BaseOption | 'upper')[]): StringValidatorBuilder;
export function stringValidator(input: string, ...prepares: (BaseOption | 'lower')[]): StringValidatorBuilder;
export function stringValidator(input: string, ...prepares: BaseOption[]): StringValidatorBuilder;
export function stringValidator(input: string, ...prepares: PrepareOption[]): StringValidatorBuilder {
  let error = '';
  const setError = (message: string) => {
    if (!error) error = message;
  };

  const processedInput = prepares.reduce((s, op) => prepareOps[op](s), input);

  const builder: StringValidatorBuilder = {
    required() {
      if (!error && !processedInput) setError('Required');
      return builder;
    },

    noSpace() {
      if (!error && processedInput.includes(' ')) setError('No space allowed');
      return builder;
    },

    minLength(length: number) {
      if (!error && processedInput.length < length) setError(`Min length ${length}`);
      return builder;
    },

    maxLength(length: number) {
      if (!error && processedInput.length > length) setError(`Max length ${length}`);
      return builder;
    },

    uppercase() {
      if (!error && processedInput !== processedInput.toLocaleUpperCase()) setError('Uppercase only');
      return builder;
    },

    lowercase() {
      if (!error && processedInput !== processedInput.toLocaleLowerCase()) setError('Lowercase only');
      return builder;
    },

    startsWith(prefix: string | string[]) {
      if (error) return builder;
      const prefixes = Array.isArray(prefix) ? prefix : [prefix];
      if (processedInput && !prefixes.some((p) => processedInput.startsWith(p)))
        setError(`Must starts with ${prefixes.join(', ')}`);
      return builder;
    },

    regexp(regexp: RegExp, message?: string) {
      if (!error && processedInput && !regexp.test(processedInput)) setError(message ?? 'Not allowed chars');
      return builder;
    },

    getError() {
      return error;
    }
  };

  return builder;
}

type StringValidatorBuilder = {
  required(): StringValidatorBuilder;
  noSpace(): StringValidatorBuilder;
  minLength(length: number): StringValidatorBuilder;
  maxLength(length: number): StringValidatorBuilder;
  uppercase(): StringValidatorBuilder;
  lowercase(): StringValidatorBuilder;
  startsWith(prefix: string | string[]): StringValidatorBuilder;
  regexp(regexp: RegExp, message?: string): StringValidatorBuilder;
  getError(): string;
};
