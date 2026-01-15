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
        setError(`Must start with ${prefixes.join(', ')}`);
      return builder;
    },

    regexp(regexp: RegExp, message?: string) {
      if (!error && processedInput && !regexp.test(processedInput)) setError(message ?? 'Not allowed chars');
      return builder;
    },

    inArray(values: string[] | Record<string, unknown>) {
      if (error) return builder;
      const allowed = Array.isArray(values) ? values : Object.keys(values);
      if (processedInput && !allowed.includes(processedInput))
        setError(`Must be one of: ${allowed.join(', ')}`);
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
  inArray(values: string[] | Record<string, unknown>): StringValidatorBuilder;
  getError(): string;
};

// Number Validator
export function numberValidator(input: number): NumberValidatorBuilder {
  let error = '';
  const setError = (message: string) => {
    if (!error) error = message;
  };

  const builder: NumberValidatorBuilder = {
    required() {
      if (!error && Number.isNaN(input)) setError('Required');
      return builder;
    },

    min(n: number) {
      if (!error && input < n) setError(`Minimum ${n}`);
      return builder;
    },

    max(n: number) {
      if (!error && input > n) setError(`Maximum ${n}`);
      return builder;
    },

    between(min: number, max: number) {
      if (!error && (input < min || input > max)) setError(`Must be between ${min} and ${max}`);
      return builder;
    },

    integer() {
      if (!error && !Number.isInteger(input)) setError('Must be an integer');
      return builder;
    },

    positive() {
      if (!error && input <= 0) setError('Must be positive');
      return builder;
    },

    negative() {
      if (!error && input >= 0) setError('Must be negative');
      return builder;
    },

    nonNegative() {
      if (!error && input < 0) setError('Must be non-negative');
      return builder;
    },

    multipleOf(n: number) {
      if (!error && input % n !== 0) setError(`Must be a multiple of ${n}`);
      return builder;
    },

    getError() {
      return error;
    }
  };

  return builder;
}

type NumberValidatorBuilder = {
  required(): NumberValidatorBuilder;
  min(n: number): NumberValidatorBuilder;
  max(n: number): NumberValidatorBuilder;
  between(min: number, max: number): NumberValidatorBuilder;
  integer(): NumberValidatorBuilder;
  positive(): NumberValidatorBuilder;
  negative(): NumberValidatorBuilder;
  nonNegative(): NumberValidatorBuilder;
  multipleOf(n: number): NumberValidatorBuilder;
  getError(): string;
};

// Array Validator
export function arrayValidator<T>(input: T[]): ArrayValidatorBuilder {
  let error = '';
  const setError = (message: string) => {
    if (!error) error = message;
  };

  const builder: ArrayValidatorBuilder = {
    required() {
      if (!error && input.length === 0) setError('Required');
      return builder;
    },

    minLength(n: number) {
      if (!error && input.length < n) setError(`Minimum ${n} items`);
      return builder;
    },

    maxLength(n: number) {
      if (!error && input.length > n) setError(`Maximum ${n} items`);
      return builder;
    },

    unique() {
      if (error) return builder;
      const seen = new Set<string>();
      for (const item of input) {
        const key = typeof item === 'object' ? JSON.stringify(item) : String(item);
        if (seen.has(key)) {
          setError('Items must be unique');
          break;
        }
        seen.add(key);
      }
      return builder;
    },

    getError() {
      return error;
    }
  };

  return builder;
}

type ArrayValidatorBuilder = {
  required(): ArrayValidatorBuilder;
  minLength(n: number): ArrayValidatorBuilder;
  maxLength(n: number): ArrayValidatorBuilder;
  unique(): ArrayValidatorBuilder;
  getError(): string;
};

// Date Validator
export function dateValidator(input: Date | string | number): DateValidatorBuilder {
  let error = '';
  const setError = (message: string) => {
    if (!error) error = message;
  };

  const date = input instanceof Date ? input : new Date(input);
  const isValid = !Number.isNaN(date.getTime());

  const builder: DateValidatorBuilder = {
    required() {
      if (!error && !isValid) setError('Required');
      return builder;
    },

    before(target: Date | string | number) {
      if (!error && isValid) {
        const targetDate = target instanceof Date ? target : new Date(target);
        if (date >= targetDate) setError(`Must be before ${targetDate.toISOString()}`);
      }
      return builder;
    },

    after(target: Date | string | number) {
      if (!error && isValid) {
        const targetDate = target instanceof Date ? target : new Date(target);
        if (date <= targetDate) setError(`Must be after ${targetDate.toISOString()}`);
      }
      return builder;
    },

    between(start: Date | string | number, end: Date | string | number) {
      if (!error && isValid) {
        const startDate = start instanceof Date ? start : new Date(start);
        const endDate = end instanceof Date ? end : new Date(end);
        if (date < startDate || date > endDate)
          setError(`Must be between ${startDate.toISOString()} and ${endDate.toISOString()}`);
      }
      return builder;
    },

    past() {
      if (!error && isValid && date >= new Date()) setError('Must be in the past');
      return builder;
    },

    future() {
      if (!error && isValid && date <= new Date()) setError('Must be in the future');
      return builder;
    },

    getError() {
      return error;
    }
  };

  return builder;
}

type DateValidatorBuilder = {
  required(): DateValidatorBuilder;
  before(target: Date | string | number): DateValidatorBuilder;
  after(target: Date | string | number): DateValidatorBuilder;
  between(start: Date | string | number, end: Date | string | number): DateValidatorBuilder;
  past(): DateValidatorBuilder;
  future(): DateValidatorBuilder;
  getError(): string;
};
