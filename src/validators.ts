class BaseValidator {
  protected error = '';
  protected setError(message: string) {
    if (!this.error) this.error = message;
  }

  public getError() {
    return this.error;
  }
}

type PrepareOption = 'trim' | 'normalize' | 'upper' | 'lower';

export class StringValidator extends BaseValidator {
  private static readonly prepareOps: Record<PrepareOption, (s: string) => string> = {
    trim: (s) => s.trim(),
    normalize: (s) => s.replaceAll(/\s{2,}/g, ' '),
    upper: (s) => s.toLocaleUpperCase(),
    lower: (s) => s.toLocaleLowerCase()
  };

  private input: string;

  constructor(input: string, ...prepares: PrepareOption[]) {
    super();
    this.input = prepares.reduce((s, op) => StringValidator.prepareOps[op](s), input);
  }

  public required(): this {
    if (this.error) return this;
    if (!this.input) this.setError('Required');
    return this;
  }

  public noSpace(): this {
    if (this.error) return this;
    if (this.input.includes(' ')) this.setError('No space allowed');
    return this;
  }

  public minLength(length: number): this {
    if (this.error) return this;
    if (this.input.length < length) this.setError(`Min length ${length}`);
    return this;
  }

  public maxLength(length: number): this {
    if (this.error) return this;
    if (this.input.length > length) this.setError(`Max length ${length}`);
    return this;
  }

  public uppercase(): this {
    if (this.error) return this;
    if (this.input !== this.input.toLocaleUpperCase()) this.setError('Uppercase only');
    return this;
  }

  public lowercase(): this {
    if (this.error) return this;
    if (this.input !== this.input.toLocaleLowerCase()) this.setError('Lowercase only');
    return this;
  }

  public startsWith(prefix: string | string[]): this {
    if (this.error) return this;
    if (!Array.isArray(prefix)) prefix = [prefix];
    if (this.input && !prefix.some((p) => this.input.startsWith(p)))
      this.setError(`Must starts with ${prefix.join(', ')}`);
    return this;
  }

  public regexp(regexp: RegExp, message?: string): this {
    if (this.error) return this;
    if (this.input && !regexp.test(this.input)) this.setError(message ?? 'Not allowed chars');
    return this;
  }
}
