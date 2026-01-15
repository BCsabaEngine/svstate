class BaseValidator {
  protected error = '';
  protected setError(message: string) {
    if (!this.error) this.error = message;
  }

  public getError() {
    return this.error;
  }
}

export class StringValidator extends BaseValidator {
  private input: string;
  constructor(input: string, ...prepares: ('trim' | 'normalize' | 'upper' | 'lower')[]) {
    super();
    this.input = input;
    for (const prepare of prepares)
      switch (prepare) {
        case 'trim':
          this.input = this.input.trim();
          break;
        case 'normalize':
          // eslint-disable-next-line unicorn/prefer-string-replace-all
          this.input = this.input.replace(/\s{2,}/g, ' ');
          break;
        case 'upper':
          this.input = this.input.toLocaleUpperCase();
          break;
        case 'lower':
          this.input = this.input.toLocaleLowerCase();
          break;
      }
  }

  public required(): StringValidator {
    if (!this.input) this.setError('Required');
    return this;
  }
  public noSpace(): StringValidator {
    if (this.input.includes(' ')) this.setError('No space allowed');
    return this;
  }
  public maxLength(length: number): StringValidator {
    if (this.input.length > length) this.setError(`Max length ${length}`);
    return this;
  }
  public uppercase(): StringValidator {
    if (this.input !== this.input.toLocaleUpperCase()) this.setError('Uppercase only');
    return this;
  }
  public lowercase(): StringValidator {
    if (this.input !== this.input.toLocaleLowerCase()) this.setError('Lowercase only');
    return this;
  }
  public startsWith(prefix: string | string[]): StringValidator {
    if (!Array.isArray(prefix)) prefix = [prefix];
    if (this.input && !prefix.some((p) => this.input.startsWith(p)))
      this.setError(`Must starts with ${prefix.join(', ')}`);
    return this;
  }
  public regexp(regexp: RegExp, message?: string): StringValidator {
    if (this.input && !regexp.test(this.input)) this.setError(message ?? 'Not allowed chars');
    return this;
  }
}
