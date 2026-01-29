type BaseOption = 'trim' | 'normalize';
type PrepareOption = BaseOption | 'upper' | 'lower';

const prepareOps: Record<PrepareOption, (s: string) => string> = {
  trim: (s) => s.trim(),
  normalize: (s) => s.replaceAll(/\s{2,}/g, ' '),
  upper: (s) => s.toUpperCase(),
  lower: (s) => s.toLowerCase()
};

export function stringValidator(input: string | null | undefined): StringValidatorBuilder {
  let error = '';
  const isNullish = input === null || input === undefined;
  let processedInput = input ?? '';

  const setError = (message: string) => {
    if (!error) error = message;
  };

  const builder: StringValidatorBuilder = {
    prepare(...prepares: PrepareOption[]) {
      processedInput = prepares.reduce((s, op) => prepareOps[op](s), processedInput);
      return builder;
    },

    required() {
      if (!error && (isNullish || !processedInput)) setError('Required');
      return builder;
    },

    noSpace() {
      if (isNullish) return builder;
      if (!error && processedInput.includes(' ')) setError('No space allowed');
      return builder;
    },

    minLength(length: number) {
      if (isNullish) return builder;
      if (!error && processedInput.length < length) setError(`Min length ${length}`);
      return builder;
    },

    maxLength(length: number) {
      if (isNullish) return builder;
      if (!error && processedInput.length > length) setError(`Max length ${length}`);
      return builder;
    },

    uppercase() {
      if (isNullish) return builder;
      if (!error && processedInput !== processedInput.toUpperCase()) setError('Uppercase only');
      return builder;
    },

    lowercase() {
      if (isNullish) return builder;
      if (!error && processedInput !== processedInput.toLowerCase()) setError('Lowercase only');
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
      if (processedInput && !allowed.includes(processedInput)) setError(`Must be one of: ${allowed.join(', ')}`);
      return builder;
    },

    email() {
      if (!error && processedInput && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(processedInput))
        setError('Invalid email format');
      return builder;
    },

    website(prefix: 'required' | 'forbidden' | 'optional' = 'optional') {
      if (error || !processedInput || prefix === 'optional') return builder;
      const hasPrefix = /^https?:\/\//.test(processedInput);
      if (prefix === 'required' && !hasPrefix) setError('Must start with http:// or https://');
      else if (prefix === 'forbidden' && hasPrefix) setError('Must not start with http:// or https://');
      return builder;
    },

    endsWith(suffix: string | string[]) {
      if (error || !processedInput) return builder;
      const suffixes = Array.isArray(suffix) ? suffix : [suffix];
      if (!suffixes.some((s) => processedInput.endsWith(s))) setError(`Must end with ${suffixes.join(', ')}`);
      return builder;
    },

    contains(substring: string) {
      if (!error && processedInput && !processedInput.includes(substring)) setError(`Must contain "${substring}"`);
      return builder;
    },

    alphanumeric() {
      if (!error && processedInput && !/^[\dA-Za-z]+$/.test(processedInput))
        setError('Only letters and numbers allowed');
      return builder;
    },

    numeric() {
      if (!error && processedInput && !/^\d+$/.test(processedInput)) setError('Only numbers allowed');
      return builder;
    },

    getError() {
      return error;
    }
  };

  return builder;
}

// Overloads enforce XOR: only 'upper' OR 'lower' allowed, not both
type StringValidatorBuilder = {
  prepare(...prepares: (BaseOption | 'upper')[]): StringValidatorBuilder;
  prepare(...prepares: (BaseOption | 'lower')[]): StringValidatorBuilder;
  prepare(...prepares: BaseOption[]): StringValidatorBuilder;
  required(): StringValidatorBuilder;
  noSpace(): StringValidatorBuilder;
  minLength(length: number): StringValidatorBuilder;
  maxLength(length: number): StringValidatorBuilder;
  uppercase(): StringValidatorBuilder;
  lowercase(): StringValidatorBuilder;
  startsWith(prefix: string | string[]): StringValidatorBuilder;
  regexp(regexp: RegExp, message?: string): StringValidatorBuilder;
  inArray(values: string[] | Record<string, unknown>): StringValidatorBuilder;
  email(): StringValidatorBuilder;
  website(prefix?: 'required' | 'forbidden' | 'optional'): StringValidatorBuilder;
  endsWith(suffix: string | string[]): StringValidatorBuilder;
  contains(substring: string): StringValidatorBuilder;
  alphanumeric(): StringValidatorBuilder;
  numeric(): StringValidatorBuilder;
  getError(): string;
};

// Number Validator
export function numberValidator(input: number | null | undefined): NumberValidatorBuilder {
  let error = '';
  const isNullish = input === null || input === undefined;
  const setError = (message: string) => {
    if (!error) error = message;
  };

  const builder: NumberValidatorBuilder = {
    required() {
      if (!error && (isNullish || Number.isNaN(input))) setError('Required');
      return builder;
    },

    min(n: number) {
      if (isNullish) return builder;
      if (!error && input < n) setError(`Minimum ${n}`);
      return builder;
    },

    max(n: number) {
      if (isNullish) return builder;
      if (!error && input > n) setError(`Maximum ${n}`);
      return builder;
    },

    between(min: number, max: number) {
      if (isNullish) return builder;
      if (!error && (input < min || input > max)) setError(`Must be between ${min} and ${max}`);
      return builder;
    },

    integer() {
      if (isNullish) return builder;
      if (!error && !Number.isInteger(input)) setError('Must be an integer');
      return builder;
    },

    positive() {
      if (isNullish) return builder;
      if (!error && input <= 0) setError('Must be positive');
      return builder;
    },

    negative() {
      if (isNullish) return builder;
      if (!error && input >= 0) setError('Must be negative');
      return builder;
    },

    nonNegative() {
      if (isNullish) return builder;
      if (!error && input < 0) setError('Must be non-negative');
      return builder;
    },

    multipleOf(n: number) {
      if (isNullish) return builder;
      if (!error && input % n !== 0) setError(`Must be a multiple of ${n}`);
      return builder;
    },

    decimal(places: number) {
      if (isNullish) return builder;
      if (error || Number.isNaN(input)) return builder;
      const parts = String(input).split('.');
      const actualPlaces = parts[1]?.length ?? 0;
      if (actualPlaces > places) setError(`Maximum ${places} decimal places`);
      return builder;
    },

    percentage() {
      if (isNullish) return builder;
      if (!error && (input < 0 || input > 100)) setError('Must be between 0 and 100');
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
  decimal(places: number): NumberValidatorBuilder;
  percentage(): NumberValidatorBuilder;
  getError(): string;
};

// Array Validator
export function arrayValidator<T>(input: T[] | null | undefined): ArrayValidatorBuilder {
  let error = '';
  const isNullish = input === null || input === undefined;
  const array = input ?? [];
  const setError = (message: string) => {
    if (!error) error = message;
  };

  const builder: ArrayValidatorBuilder = {
    required() {
      if (!error && (isNullish || array.length === 0)) setError('Required');
      return builder;
    },

    minLength(n: number) {
      if (isNullish) return builder;
      if (!error && array.length < n) setError(`Minimum ${n} items`);
      return builder;
    },

    maxLength(n: number) {
      if (isNullish) return builder;
      if (!error && array.length > n) setError(`Maximum ${n} items`);
      return builder;
    },

    unique() {
      if (isNullish) return builder;
      if (error) return builder;
      const seen = new Set<string>();
      for (const item of array) {
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
export function dateValidator(input: Date | string | number | null | undefined): DateValidatorBuilder {
  let error = '';
  const isNullish = input === null || input === undefined;
  const setError = (message: string) => {
    if (!error) error = message;
  };

  const date = isNullish ? new Date(Number.NaN) : input instanceof Date ? input : new Date(input);
  const isValid = !isNullish && !Number.isNaN(date.getTime());

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

    weekday() {
      if (!error && isValid) {
        const day = date.getDay();
        if (day === 0 || day === 6) setError('Must be a weekday');
      }
      return builder;
    },

    weekend() {
      if (!error && isValid) {
        const day = date.getDay();
        if (day !== 0 && day !== 6) setError('Must be a weekend');
      }
      return builder;
    },

    minAge(years: number) {
      if (!error && isValid) {
        const minDate = new Date();
        minDate.setFullYear(minDate.getFullYear() - years);
        if (date > minDate) setError(`Must be at least ${years} years ago`);
      }
      return builder;
    },

    maxAge(years: number) {
      if (!error && isValid) {
        const maxDate = new Date();
        maxDate.setFullYear(maxDate.getFullYear() - years);
        if (date < maxDate) setError(`Must be at most ${years} years ago`);
      }
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
  weekday(): DateValidatorBuilder;
  weekend(): DateValidatorBuilder;
  minAge(years: number): DateValidatorBuilder;
  maxAge(years: number): DateValidatorBuilder;
  getError(): string;
};
