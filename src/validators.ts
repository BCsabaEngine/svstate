const EPSILON = 1e-9;

// Counts decimal places for exponential notation too — String(1e-7) is '1e-7', not '0.0000001'
const countDecimalPlaces = (value: number): number => {
  if (Number.isSafeInteger(value)) return 0;
  const text = String(value);
  const exponentIndex = text.indexOf('e-');
  if (exponentIndex === -1) return text.split('.', 2)[1]?.length ?? 0;
  const mantissa = text.slice(0, exponentIndex);
  const exponent = Number(text.slice(exponentIndex + 2));
  return (mantissa.split('.', 2)[1]?.length ?? 0) + exponent;
};

// Tolerant divisibility: an exact `%` reports 0.3 as not a multiple of 0.1
const isMultipleOf = (value: number, divisor: number): boolean => {
  if (divisor === 0) return false;
  const remainder = Math.abs(value % divisor);
  return remainder < EPSILON || Math.abs(remainder - Math.abs(divisor)) < EPSILON;
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? String(value);
  if (value instanceof Date) return `Date(${value.getTime()})`;
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).toSorted(([a], [b]) => (a < b ? -1 : 1));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
};

// Type-tagged so 1 and '1' (or null and 'null') never collide, and key order never matters
const toComparableKey = (value: unknown): string => {
  if (value === null) return 'null';
  if (typeof value === 'object') return `object:${stableStringify(value)}`;
  return `${typeof value}:${String(value)}`;
};

const toDisplay = (value: unknown): string =>
  value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value);

type BaseOption = 'trim' | 'normalize';
type PrepareOption = BaseOption | 'upper' | 'lower' | 'localeUpper' | 'localeLower';

const prepareOps: Record<PrepareOption, (s: string) => string> = {
  trim: (s) => s.trim(),
  normalize: (s) => s.replaceAll(/\s{2,}/g, ' '),
  upper: (s) => s.toUpperCase(),
  lower: (s) => s.toLowerCase(),
  localeUpper: (s) => s.toLocaleUpperCase(),
  localeLower: (s) => s.toLocaleLowerCase()
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

    requiredIf(shouldRequire: boolean) {
      if (shouldRequire && !error && (isNullish || !processedInput)) setError('Required');
      return builder;
    },

    noSpace() {
      if (isNullish) return builder;
      if (!error && processedInput.includes(' ')) setError('No space allowed');
      return builder;
    },

    notBlank() {
      if (isNullish) return builder;
      if (!error && processedInput.length > 0 && processedInput.trim().length === 0) setError('Must not be blank');
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
      if (processedInput && prefixes.every((p) => !processedInput.startsWith(p)))
        setError(`Must start with ${prefixes.join(', ')}`);
      return builder;
    },

    regexp(regexp: RegExp, message?: string) {
      if (!error && processedInput && !regexp.test(processedInput)) setError(message ?? 'Not allowed chars');
      return builder;
    },

    in(values: string[] | Record<string, unknown>) {
      if (error) return builder;
      const allowed = Array.isArray(values) ? values : Object.keys(values);
      if (processedInput && !allowed.includes(processedInput)) setError(`Must be one of: ${allowed.join(', ')}`);
      return builder;
    },

    notIn(values: string[] | Record<string, unknown>) {
      if (error) return builder;
      const disallowed = Array.isArray(values) ? values : Object.keys(values);
      if (processedInput && disallowed.includes(processedInput))
        setError(`Must not be one of: ${disallowed.join(', ')}`);
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
      if (suffixes.every((s) => !processedInput.endsWith(s))) setError(`Must end with ${suffixes.join(', ')}`);
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

    slug() {
      if (!error && processedInput && !/^[\da-z-]+$/.test(processedInput)) setError('Invalid slug format');
      return builder;
    },

    identifier() {
      if (!error && processedInput && !/^[A-Z_a-z]\w*$/.test(processedInput)) setError('Invalid identifier format');
      return builder;
    },

    getError() {
      return error;
    }
  };

  return builder;
}

// Overloads enforce XOR: only one case variant allowed at a time
type StringValidatorBuilder = {
  prepare(...prepares: (BaseOption | 'upper')[]): StringValidatorBuilder;
  prepare(...prepares: (BaseOption | 'lower')[]): StringValidatorBuilder;
  prepare(...prepares: (BaseOption | 'localeUpper')[]): StringValidatorBuilder;
  prepare(...prepares: (BaseOption | 'localeLower')[]): StringValidatorBuilder;
  prepare(...prepares: BaseOption[]): StringValidatorBuilder;
  required(): StringValidatorBuilder;
  requiredIf(shouldRequire: boolean): StringValidatorBuilder;
  noSpace(): StringValidatorBuilder;
  notBlank(): StringValidatorBuilder;
  minLength(length: number): StringValidatorBuilder;
  maxLength(length: number): StringValidatorBuilder;
  uppercase(): StringValidatorBuilder;
  lowercase(): StringValidatorBuilder;
  startsWith(prefix: string | string[]): StringValidatorBuilder;
  regexp(regexp: RegExp, message?: string): StringValidatorBuilder;
  in(values: string[] | Record<string, unknown>): StringValidatorBuilder;
  notIn(values: string[] | Record<string, unknown>): StringValidatorBuilder;
  email(): StringValidatorBuilder;
  website(prefix?: 'required' | 'forbidden' | 'optional'): StringValidatorBuilder;
  endsWith(suffix: string | string[]): StringValidatorBuilder;
  contains(substring: string): StringValidatorBuilder;
  alphanumeric(): StringValidatorBuilder;
  numeric(): StringValidatorBuilder;
  slug(): StringValidatorBuilder;
  identifier(): StringValidatorBuilder;
  getError(): string;
};

// Number Validator
export function numberValidator(input: number | null | undefined): NumberValidatorBuilder {
  let error = '';
  const isNullish = input === null || input === undefined;
  // NaN carries no comparable value — only required() reports it, every other rule skips it
  const isMissing = isNullish || Number.isNaN(input);
  const setError = (message: string) => {
    if (!error) error = message;
  };

  const builder: NumberValidatorBuilder = {
    required() {
      if (!error && (isNullish || Number.isNaN(input))) setError('Required');
      return builder;
    },

    requiredIf(shouldRequire: boolean) {
      if (shouldRequire && !error && (isNullish || Number.isNaN(input))) setError('Required');
      return builder;
    },

    min(n: number) {
      if (isMissing) return builder;
      if (!error && input < n) setError(`Minimum ${n}`);
      return builder;
    },

    max(n: number) {
      if (isMissing) return builder;
      if (!error && input > n) setError(`Maximum ${n}`);
      return builder;
    },

    between(min: number, max: number) {
      if (isMissing) return builder;
      if (!error && (input < min || input > max)) setError(`Must be between ${min} and ${max}`);
      return builder;
    },

    integer() {
      if (isMissing) return builder;
      if (!error && !Number.isSafeInteger(input)) setError('Must be an integer');
      return builder;
    },

    positive() {
      if (isMissing) return builder;
      if (!error && input <= 0) setError('Must be positive');
      return builder;
    },

    negative() {
      if (isMissing) return builder;
      if (!error && input >= 0) setError('Must be negative');
      return builder;
    },

    nonNegative() {
      if (isMissing) return builder;
      if (!error && input < 0) setError('Must be non-negative');
      return builder;
    },

    notZero() {
      if (isMissing) return builder;
      if (!error && input === 0) setError('Must not be zero');
      return builder;
    },

    multipleOf(n: number) {
      if (isMissing) return builder;
      if (!error && !isMultipleOf(input, n)) setError(`Must be a multiple of ${n}`);
      return builder;
    },

    step(n: number) {
      if (isMissing) return builder;
      if (!error && !isMultipleOf(input, n)) setError(`Must be a multiple of ${n}`);
      return builder;
    },

    decimal(places: number) {
      if (isMissing || error) return builder;
      if (countDecimalPlaces(input) > places) setError(`Maximum ${places} decimal places`);
      return builder;
    },

    percentage() {
      if (isMissing) return builder;
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
  requiredIf(shouldRequire: boolean): NumberValidatorBuilder;
  min(n: number): NumberValidatorBuilder;
  max(n: number): NumberValidatorBuilder;
  between(min: number, max: number): NumberValidatorBuilder;
  integer(): NumberValidatorBuilder;
  positive(): NumberValidatorBuilder;
  negative(): NumberValidatorBuilder;
  nonNegative(): NumberValidatorBuilder;
  notZero(): NumberValidatorBuilder;
  multipleOf(n: number): NumberValidatorBuilder;
  step(n: number): NumberValidatorBuilder;
  decimal(places: number): NumberValidatorBuilder;
  percentage(): NumberValidatorBuilder;
  getError(): string;
};

// Array Validator
export function arrayValidator<T>(input: T[] | null | undefined): ArrayValidatorBuilder<T> {
  let error = '';
  const isNullish = input === null || input === undefined;
  const array = input ?? [];
  const setError = (message: string) => {
    if (!error) error = message;
  };

  const builder: ArrayValidatorBuilder<T> = {
    required() {
      if (!error && (isNullish || array.length === 0)) setError('Required');
      return builder;
    },

    requiredIf(shouldRequire: boolean) {
      if (shouldRequire && !error && (isNullish || array.length === 0)) setError('Required');
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
        const key = toComparableKey(item);
        if (seen.has(key)) {
          setError('Items must be unique');
          break;
        }
        seen.add(key);
      }
      return builder;
    },

    ofLength(n: number) {
      if (isNullish) return builder;
      if (!error && array.length !== n) setError(`Must have exactly ${n} items`);
      return builder;
    },

    includes(item: T) {
      if (isNullish) return builder;
      if (error) return builder;
      const itemKey = toComparableKey(item);
      const found = array.some((element) => toComparableKey(element) === itemKey);
      if (!found) setError(`Must include ${toDisplay(item)}`);
      return builder;
    },

    includesAny(items: T[]) {
      if (isNullish) return builder;
      if (error) return builder;
      const itemKeys = new Set(items.map((entry) => toComparableKey(entry)));
      const found = array.some((element) => itemKeys.has(toComparableKey(element)));
      if (!found) setError(`Must include at least one of: ${items.map((entry) => toDisplay(entry)).join(', ')}`);
      return builder;
    },

    includesAll(items: T[]) {
      if (isNullish) return builder;
      if (error) return builder;
      const arrayKeys = new Set(array.map((element) => toComparableKey(element)));
      const missing = items.filter((entry) => !arrayKeys.has(toComparableKey(entry)));
      if (missing.length > 0)
        setError(`Missing required items: ${missing.map((entry) => toDisplay(entry)).join(', ')}`);
      return builder;
    },

    getError() {
      return error;
    }
  };

  return builder;
}

type ArrayValidatorBuilder<T> = {
  required(): ArrayValidatorBuilder<T>;
  requiredIf(shouldRequire: boolean): ArrayValidatorBuilder<T>;
  minLength(n: number): ArrayValidatorBuilder<T>;
  maxLength(n: number): ArrayValidatorBuilder<T>;
  unique(): ArrayValidatorBuilder<T>;
  ofLength(n: number): ArrayValidatorBuilder<T>;
  includes(item: T): ArrayValidatorBuilder<T>;
  includesAny(items: T[]): ArrayValidatorBuilder<T>;
  includesAll(items: T[]): ArrayValidatorBuilder<T>;
  getError(): string;
};

// Date Validator
export function dateValidator(input: Date | string | number | null | undefined): DateValidatorBuilder {
  let error = '';
  const isNullish = input === null || input === undefined;
  const setError = (message: string) => {
    if (!error) error = message;
  };

  const date = isNullish ? new Date(NaN) : input instanceof Date ? input : new Date(input);
  const isValid = !isNullish && !Number.isNaN(date.getTime());

  const builder: DateValidatorBuilder = {
    required() {
      if (!error && !isValid) setError('Required');
      return builder;
    },

    requiredIf(shouldRequire: boolean) {
      if (shouldRequire && !error && !isValid) setError('Required');
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
  requiredIf(shouldRequire: boolean): DateValidatorBuilder;
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
