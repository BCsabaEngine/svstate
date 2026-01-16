import { arrayValidator, dateValidator, numberValidator, stringValidator } from '../src/validators';

describe('stringValidator', () => {
  describe('prepare options', () => {
    it('should trim whitespace', () => {
      expect(stringValidator('  hello  ', 'trim').required().getError()).toBe('');
      expect(stringValidator('  hello  ', 'trim').minLength(6).getError()).toBe('Min length 6');
    });

    it('should normalize multiple spaces', () => {
      expect(stringValidator('hello   world', 'normalize').noSpace().getError()).toBe('No space allowed');
      expect(stringValidator('hello   world', 'normalize').minLength(12).getError()).toBe('Min length 12');
    });

    it('should convert to uppercase', () => {
      expect(stringValidator('hello', 'upper').uppercase().getError()).toBe('');
      expect(stringValidator('hello', 'upper').lowercase().getError()).toBe('Lowercase only');
    });

    it('should convert to lowercase', () => {
      expect(stringValidator('HELLO', 'lower').lowercase().getError()).toBe('');
      expect(stringValidator('HELLO', 'lower').uppercase().getError()).toBe('Uppercase only');
    });

    it('should chain multiple prepare options', () => {
      expect(stringValidator('  HELLO  ', 'trim', 'lower').getError()).toBe('');
      expect(stringValidator('  HELLO  ', 'trim', 'lower').uppercase().getError()).toBe('Uppercase only');
    });
  });

  describe('required', () => {
    it('should pass for non-empty string', () => {
      expect(stringValidator('hello').required().getError()).toBe('');
    });

    it('should fail for empty string', () => {
      expect(stringValidator('').required().getError()).toBe('Required');
    });

    it('should fail for whitespace-only when trimmed', () => {
      expect(stringValidator('   ', 'trim').required().getError()).toBe('Required');
    });
  });

  describe('noSpace', () => {
    it('should pass for string without spaces', () => {
      expect(stringValidator('hello').noSpace().getError()).toBe('');
    });

    it('should fail for string with spaces', () => {
      expect(stringValidator('hello world').noSpace().getError()).toBe('No space allowed');
    });
  });

  describe('minLength', () => {
    it('should pass when length meets minimum', () => {
      expect(stringValidator('hello').minLength(5).getError()).toBe('');
    });

    it('should pass when length exceeds minimum', () => {
      expect(stringValidator('hello world').minLength(5).getError()).toBe('');
    });

    it('should fail when length is below minimum', () => {
      expect(stringValidator('hi').minLength(5).getError()).toBe('Min length 5');
    });
  });

  describe('maxLength', () => {
    it('should pass when length is at maximum', () => {
      expect(stringValidator('hello').maxLength(5).getError()).toBe('');
    });

    it('should pass when length is below maximum', () => {
      expect(stringValidator('hi').maxLength(5).getError()).toBe('');
    });

    it('should fail when length exceeds maximum', () => {
      expect(stringValidator('hello world').maxLength(5).getError()).toBe('Max length 5');
    });
  });

  describe('uppercase', () => {
    it('should pass for uppercase string', () => {
      expect(stringValidator('HELLO').uppercase().getError()).toBe('');
    });

    it('should fail for lowercase string', () => {
      expect(stringValidator('hello').uppercase().getError()).toBe('Uppercase only');
    });

    it('should fail for mixed case string', () => {
      expect(stringValidator('Hello').uppercase().getError()).toBe('Uppercase only');
    });
  });

  describe('lowercase', () => {
    it('should pass for lowercase string', () => {
      expect(stringValidator('hello').lowercase().getError()).toBe('');
    });

    it('should fail for uppercase string', () => {
      expect(stringValidator('HELLO').lowercase().getError()).toBe('Lowercase only');
    });

    it('should fail for mixed case string', () => {
      expect(stringValidator('Hello').lowercase().getError()).toBe('Lowercase only');
    });
  });

  describe('startsWith', () => {
    it('should pass when string starts with prefix', () => {
      expect(stringValidator('hello world').startsWith('hello').getError()).toBe('');
    });

    it('should pass when string starts with one of multiple prefixes', () => {
      expect(stringValidator('hello world').startsWith(['hi', 'hello']).getError()).toBe('');
    });

    it('should fail when string does not start with prefix', () => {
      expect(stringValidator('hello world').startsWith('world').getError()).toBe('Must start with world');
    });

    it('should fail when string does not start with any prefix', () => {
      expect(stringValidator('hello world').startsWith(['foo', 'bar']).getError()).toBe('Must start with foo, bar');
    });

    it('should skip validation for empty string', () => {
      expect(stringValidator('').startsWith('hello').getError()).toBe('');
    });
  });

  describe('regexp', () => {
    it('should pass when string matches regexp', () => {
      expect(
        stringValidator('hello123')
          .regexp(/^[\da-z]+$/)
          .getError()
      ).toBe('');
    });

    it('should fail when string does not match regexp', () => {
      expect(
        stringValidator('hello!')
          .regexp(/^[\da-z]+$/)
          .getError()
      ).toBe('Not allowed chars');
    });

    it('should use custom error message', () => {
      expect(
        stringValidator('hello!')
          .regexp(/^[\da-z]+$/, 'Only alphanumeric')
          .getError()
      ).toBe('Only alphanumeric');
    });

    it('should skip validation for empty string', () => {
      expect(
        stringValidator('')
          .regexp(/^[a-z]+$/)
          .getError()
      ).toBe('');
    });
  });

  describe('inArray', () => {
    it('should pass when string is in array', () => {
      expect(stringValidator('apple').inArray(['apple', 'banana']).getError()).toBe('');
    });

    it('should pass when string is a key in object', () => {
      expect(stringValidator('apple').inArray({ apple: 1, banana: 2 }).getError()).toBe('');
    });

    it('should fail when string is not in array', () => {
      expect(stringValidator('orange').inArray(['apple', 'banana']).getError()).toBe('Must be one of: apple, banana');
    });

    it('should fail when string is not a key in object', () => {
      expect(stringValidator('orange').inArray({ apple: 1, banana: 2 }).getError()).toBe(
        'Must be one of: apple, banana'
      );
    });

    it('should skip validation for empty string', () => {
      expect(stringValidator('').inArray(['apple', 'banana']).getError()).toBe('');
    });
  });

  describe('email', () => {
    it('should pass for valid email', () => {
      expect(stringValidator('user@example.com').email().getError()).toBe('');
    });

    it('should pass for email with subdomain', () => {
      expect(stringValidator('user@mail.example.com').email().getError()).toBe('');
    });

    it('should pass for email with plus sign', () => {
      expect(stringValidator('user+tag@example.com').email().getError()).toBe('');
    });

    it('should fail for email without @', () => {
      expect(stringValidator('userexample.com').email().getError()).toBe('Invalid email format');
    });

    it('should fail for email without domain', () => {
      expect(stringValidator('user@').email().getError()).toBe('Invalid email format');
    });

    it('should fail for email without local part', () => {
      expect(stringValidator('@example.com').email().getError()).toBe('Invalid email format');
    });

    it('should fail for email with spaces', () => {
      expect(stringValidator('user @example.com').email().getError()).toBe('Invalid email format');
    });

    it('should skip validation for empty string', () => {
      expect(stringValidator('').email().getError()).toBe('');
    });
  });

  describe('website', () => {
    describe('required prefix', () => {
      it('should pass for https URL', () => {
        expect(stringValidator('https://example.com').website('required').getError()).toBe('');
      });

      it('should pass for http URL', () => {
        expect(stringValidator('http://example.com').website('required').getError()).toBe('');
      });

      it('should fail for URL without prefix', () => {
        expect(stringValidator('example.com').website('required').getError()).toBe(
          'Must start with http:// or https://'
        );
      });

      it('should fail for URL with wrong prefix', () => {
        expect(stringValidator('ftp://example.com').website('required').getError()).toBe(
          'Must start with http:// or https://'
        );
      });
    });

    describe('forbidden prefix', () => {
      it('should pass for URL without prefix', () => {
        expect(stringValidator('example.com').website('forbidden').getError()).toBe('');
      });

      it('should fail for https URL', () => {
        expect(stringValidator('https://example.com').website('forbidden').getError()).toBe(
          'Must not start with http:// or https://'
        );
      });

      it('should fail for http URL', () => {
        expect(stringValidator('http://example.com').website('forbidden').getError()).toBe(
          'Must not start with http:// or https://'
        );
      });
    });

    describe('optional prefix', () => {
      it('should pass for URL with https prefix', () => {
        expect(stringValidator('https://example.com').website('optional').getError()).toBe('');
      });

      it('should pass for URL with http prefix', () => {
        expect(stringValidator('http://example.com').website('optional').getError()).toBe('');
      });

      it('should pass for URL without prefix', () => {
        expect(stringValidator('example.com').website('optional').getError()).toBe('');
      });
    });

    describe('default parameter', () => {
      it('should default to optional when no parameter provided', () => {
        expect(stringValidator('https://example.com').website().getError()).toBe('');
        expect(stringValidator('http://example.com').website().getError()).toBe('');
        expect(stringValidator('example.com').website().getError()).toBe('');
      });
    });

    it('should skip validation for empty string', () => {
      expect(stringValidator('').website('required').getError()).toBe('');
      expect(stringValidator('').website('forbidden').getError()).toBe('');
      expect(stringValidator('').website('optional').getError()).toBe('');
      expect(stringValidator('').website().getError()).toBe('');
    });
  });

  describe('endsWith', () => {
    it('should pass when string ends with suffix', () => {
      expect(stringValidator('hello.txt').endsWith('.txt').getError()).toBe('');
    });

    it('should pass when string ends with one of multiple suffixes', () => {
      expect(stringValidator('image.png').endsWith(['.jpg', '.png']).getError()).toBe('');
    });

    it('should fail when string does not end with suffix', () => {
      expect(stringValidator('hello.txt').endsWith('.pdf').getError()).toBe('Must end with .pdf');
    });

    it('should fail when string does not end with any suffix', () => {
      expect(stringValidator('document.doc').endsWith(['.pdf', '.txt']).getError()).toBe('Must end with .pdf, .txt');
    });

    it('should skip validation for empty string', () => {
      expect(stringValidator('').endsWith('.txt').getError()).toBe('');
    });
  });

  describe('contains', () => {
    it('should pass when string contains substring', () => {
      expect(stringValidator('hello world').contains('world').getError()).toBe('');
    });

    it('should fail when string does not contain substring', () => {
      expect(stringValidator('hello').contains('world').getError()).toBe('Must contain "world"');
    });

    it('should skip validation for empty string', () => {
      expect(stringValidator('').contains('test').getError()).toBe('');
    });
  });

  describe('alphanumeric', () => {
    it('should pass for alphanumeric string', () => {
      expect(stringValidator('Hello123').alphanumeric().getError()).toBe('');
    });

    it('should pass for letters only', () => {
      expect(stringValidator('Hello').alphanumeric().getError()).toBe('');
    });

    it('should pass for numbers only', () => {
      expect(stringValidator('123').alphanumeric().getError()).toBe('');
    });

    it('should fail for string with special characters', () => {
      expect(stringValidator('hello!').alphanumeric().getError()).toBe('Only letters and numbers allowed');
    });

    it('should fail for string with spaces', () => {
      expect(stringValidator('hello world').alphanumeric().getError()).toBe('Only letters and numbers allowed');
    });

    it('should skip validation for empty string', () => {
      expect(stringValidator('').alphanumeric().getError()).toBe('');
    });
  });

  describe('numeric', () => {
    it('should pass for numeric string', () => {
      expect(stringValidator('12345').numeric().getError()).toBe('');
    });

    it('should fail for string with letters', () => {
      expect(stringValidator('123abc').numeric().getError()).toBe('Only numbers allowed');
    });

    it('should fail for string with special characters', () => {
      expect(stringValidator('123-456').numeric().getError()).toBe('Only numbers allowed');
    });

    it('should skip validation for empty string', () => {
      expect(stringValidator('').numeric().getError()).toBe('');
    });
  });

  describe('method chaining', () => {
    it('should return first error only', () => {
      expect(stringValidator('').required().minLength(5).getError()).toBe('Required');
    });

    it('should chain multiple validations successfully', () => {
      expect(stringValidator('HELLO').required().minLength(3).maxLength(10).uppercase().getError()).toBe('');
    });

    it('should stop at first error in chain', () => {
      expect(stringValidator('hi').minLength(5).maxLength(1).getError()).toBe('Min length 5');
    });
  });
});

describe('numberValidator', () => {
  describe('required', () => {
    it('should pass for valid number', () => {
      expect(numberValidator(5).required().getError()).toBe('');
    });

    it('should pass for zero', () => {
      expect(numberValidator(0).required().getError()).toBe('');
    });

    it('should fail for NaN', () => {
      expect(numberValidator(Number.NaN).required().getError()).toBe('Required');
    });
  });

  describe('min', () => {
    it('should pass when number equals minimum', () => {
      expect(numberValidator(5).min(5).getError()).toBe('');
    });

    it('should pass when number exceeds minimum', () => {
      expect(numberValidator(10).min(5).getError()).toBe('');
    });

    it('should fail when number is below minimum', () => {
      expect(numberValidator(3).min(5).getError()).toBe('Minimum 5');
    });
  });

  describe('max', () => {
    it('should pass when number equals maximum', () => {
      expect(numberValidator(5).max(5).getError()).toBe('');
    });

    it('should pass when number is below maximum', () => {
      expect(numberValidator(3).max(5).getError()).toBe('');
    });

    it('should fail when number exceeds maximum', () => {
      expect(numberValidator(10).max(5).getError()).toBe('Maximum 5');
    });
  });

  describe('between', () => {
    it('should pass when number equals minimum', () => {
      expect(numberValidator(5).between(5, 10).getError()).toBe('');
    });

    it('should pass when number equals maximum', () => {
      expect(numberValidator(10).between(5, 10).getError()).toBe('');
    });

    it('should pass when number is in range', () => {
      expect(numberValidator(7).between(5, 10).getError()).toBe('');
    });

    it('should fail when number is below range', () => {
      expect(numberValidator(3).between(5, 10).getError()).toBe('Must be between 5 and 10');
    });

    it('should fail when number is above range', () => {
      expect(numberValidator(15).between(5, 10).getError()).toBe('Must be between 5 and 10');
    });
  });

  describe('integer', () => {
    it('should pass for integer', () => {
      expect(numberValidator(5).integer().getError()).toBe('');
    });

    it('should pass for negative integer', () => {
      expect(numberValidator(-5).integer().getError()).toBe('');
    });

    it('should pass for zero', () => {
      expect(numberValidator(0).integer().getError()).toBe('');
    });

    it('should fail for decimal', () => {
      expect(numberValidator(5.5).integer().getError()).toBe('Must be an integer');
    });
  });

  describe('positive', () => {
    it('should pass for positive number', () => {
      expect(numberValidator(5).positive().getError()).toBe('');
    });

    it('should fail for zero', () => {
      expect(numberValidator(0).positive().getError()).toBe('Must be positive');
    });

    it('should fail for negative number', () => {
      expect(numberValidator(-5).positive().getError()).toBe('Must be positive');
    });
  });

  describe('negative', () => {
    it('should pass for negative number', () => {
      expect(numberValidator(-5).negative().getError()).toBe('');
    });

    it('should fail for zero', () => {
      expect(numberValidator(0).negative().getError()).toBe('Must be negative');
    });

    it('should fail for positive number', () => {
      expect(numberValidator(5).negative().getError()).toBe('Must be negative');
    });
  });

  describe('nonNegative', () => {
    it('should pass for positive number', () => {
      expect(numberValidator(5).nonNegative().getError()).toBe('');
    });

    it('should pass for zero', () => {
      expect(numberValidator(0).nonNegative().getError()).toBe('');
    });

    it('should fail for negative number', () => {
      expect(numberValidator(-5).nonNegative().getError()).toBe('Must be non-negative');
    });
  });

  describe('multipleOf', () => {
    it('should pass when number is multiple', () => {
      expect(numberValidator(10).multipleOf(5).getError()).toBe('');
    });

    it('should pass for zero', () => {
      expect(numberValidator(0).multipleOf(5).getError()).toBe('');
    });

    it('should fail when number is not multiple', () => {
      expect(numberValidator(7).multipleOf(5).getError()).toBe('Must be a multiple of 5');
    });
  });

  describe('decimal', () => {
    it('should pass when decimal places are within limit', () => {
      expect(numberValidator(3.14).decimal(2).getError()).toBe('');
    });

    it('should pass for integer when decimal places allowed', () => {
      expect(numberValidator(5).decimal(2).getError()).toBe('');
    });

    it('should pass for fewer decimal places than limit', () => {
      expect(numberValidator(3.1).decimal(2).getError()).toBe('');
    });

    it('should fail when decimal places exceed limit', () => {
      expect(numberValidator(3.141_59).decimal(2).getError()).toBe('Maximum 2 decimal places');
    });

    it('should pass for zero decimal places with integer', () => {
      expect(numberValidator(5).decimal(0).getError()).toBe('');
    });

    it('should fail for any decimal when zero places allowed', () => {
      expect(numberValidator(5.1).decimal(0).getError()).toBe('Maximum 0 decimal places');
    });
  });

  describe('percentage', () => {
    it('should pass for value at 0', () => {
      expect(numberValidator(0).percentage().getError()).toBe('');
    });

    it('should pass for value at 100', () => {
      expect(numberValidator(100).percentage().getError()).toBe('');
    });

    it('should pass for value in range', () => {
      expect(numberValidator(50).percentage().getError()).toBe('');
    });

    it('should fail for value below 0', () => {
      expect(numberValidator(-1).percentage().getError()).toBe('Must be between 0 and 100');
    });

    it('should fail for value above 100', () => {
      expect(numberValidator(101).percentage().getError()).toBe('Must be between 0 and 100');
    });
  });

  describe('edge cases', () => {
    it('should handle Infinity', () => {
      expect(numberValidator(Infinity).max(100).getError()).toBe('Maximum 100');
    });

    it('should handle negative Infinity', () => {
      expect(numberValidator(-Infinity).min(0).getError()).toBe('Minimum 0');
    });
  });

  describe('method chaining', () => {
    it('should return first error only', () => {
      expect(numberValidator(Number.NaN).required().min(5).getError()).toBe('Required');
    });

    it('should chain multiple validations successfully', () => {
      expect(numberValidator(10).required().min(5).max(15).integer().positive().getError()).toBe('');
    });
  });
});

describe('arrayValidator', () => {
  describe('required', () => {
    it('should pass for non-empty array', () => {
      expect(arrayValidator([1, 2, 3]).required().getError()).toBe('');
    });

    it('should fail for empty array', () => {
      expect(arrayValidator([]).required().getError()).toBe('Required');
    });
  });

  describe('minLength', () => {
    it('should pass when array length equals minimum', () => {
      expect(arrayValidator([1, 2, 3]).minLength(3).getError()).toBe('');
    });

    it('should pass when array length exceeds minimum', () => {
      expect(arrayValidator([1, 2, 3, 4, 5]).minLength(3).getError()).toBe('');
    });

    it('should fail when array length is below minimum', () => {
      expect(arrayValidator([1, 2]).minLength(3).getError()).toBe('Minimum 3 items');
    });
  });

  describe('maxLength', () => {
    it('should pass when array length equals maximum', () => {
      expect(arrayValidator([1, 2, 3]).maxLength(3).getError()).toBe('');
    });

    it('should pass when array length is below maximum', () => {
      expect(arrayValidator([1, 2]).maxLength(3).getError()).toBe('');
    });

    it('should fail when array length exceeds maximum', () => {
      expect(arrayValidator([1, 2, 3, 4, 5]).maxLength(3).getError()).toBe('Maximum 3 items');
    });
  });

  describe('unique', () => {
    it('should pass for unique primitives', () => {
      expect(arrayValidator([1, 2, 3]).unique().getError()).toBe('');
    });

    it('should pass for unique strings', () => {
      expect(arrayValidator(['a', 'b', 'c']).unique().getError()).toBe('');
    });

    it('should fail for duplicate primitives', () => {
      expect(arrayValidator([1, 2, 2, 3]).unique().getError()).toBe('Items must be unique');
    });

    it('should fail for duplicate strings', () => {
      expect(arrayValidator(['a', 'b', 'a']).unique().getError()).toBe('Items must be unique');
    });

    it('should pass for unique objects', () => {
      expect(
        arrayValidator([{ a: 1 }, { a: 2 }])
          .unique()
          .getError()
      ).toBe('');
    });

    it('should fail for duplicate objects', () => {
      expect(
        arrayValidator([{ a: 1 }, { a: 1 }])
          .unique()
          .getError()
      ).toBe('Items must be unique');
    });

    it('should pass for empty array', () => {
      expect(arrayValidator([]).unique().getError()).toBe('');
    });
  });

  describe('method chaining', () => {
    it('should return first error only', () => {
      expect(arrayValidator([]).required().minLength(3).getError()).toBe('Required');
    });

    it('should chain multiple validations successfully', () => {
      expect(arrayValidator([1, 2, 3]).required().minLength(2).maxLength(5).unique().getError()).toBe('');
    });
  });
});

describe('dateValidator', () => {
  const pastDate = new Date('2020-01-01');
  const futureDate = new Date('2099-01-01');
  const referenceDate = new Date('2024-06-15');

  describe('input types', () => {
    it('should accept Date object', () => {
      expect(dateValidator(new Date('2024-01-01')).required().getError()).toBe('');
    });

    it('should accept ISO string', () => {
      expect(dateValidator('2024-01-01').required().getError()).toBe('');
    });

    it('should accept timestamp', () => {
      expect(dateValidator(1_704_067_200_000).required().getError()).toBe('');
    });
  });

  describe('required', () => {
    it('should pass for valid date', () => {
      expect(dateValidator(new Date()).required().getError()).toBe('');
    });

    it('should fail for invalid date', () => {
      expect(dateValidator(new Date('invalid')).required().getError()).toBe('Required');
    });

    it('should fail for invalid string', () => {
      expect(dateValidator('not-a-date').required().getError()).toBe('Required');
    });
  });

  describe('before', () => {
    it('should pass when date is before target', () => {
      expect(dateValidator(pastDate).before(referenceDate).getError()).toBe('');
    });

    it('should fail when date equals target', () => {
      const error = dateValidator(referenceDate).before(referenceDate).getError();
      expect(error).toContain('Must be before');
    });

    it('should fail when date is after target', () => {
      const error = dateValidator(futureDate).before(referenceDate).getError();
      expect(error).toContain('Must be before');
    });

    it('should accept string as target', () => {
      expect(dateValidator(pastDate).before('2024-06-15').getError()).toBe('');
    });

    it('should accept timestamp as target', () => {
      expect(dateValidator(pastDate).before(referenceDate.getTime()).getError()).toBe('');
    });
  });

  describe('after', () => {
    it('should pass when date is after target', () => {
      expect(dateValidator(futureDate).after(referenceDate).getError()).toBe('');
    });

    it('should fail when date equals target', () => {
      const error = dateValidator(referenceDate).after(referenceDate).getError();
      expect(error).toContain('Must be after');
    });

    it('should fail when date is before target', () => {
      const error = dateValidator(pastDate).after(referenceDate).getError();
      expect(error).toContain('Must be after');
    });

    it('should accept string as target', () => {
      expect(dateValidator(futureDate).after('2024-06-15').getError()).toBe('');
    });

    it('should accept timestamp as target', () => {
      expect(dateValidator(futureDate).after(referenceDate.getTime()).getError()).toBe('');
    });
  });

  describe('between', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-12-31');
    const middle = new Date('2024-06-15');

    it('should pass when date equals start', () => {
      expect(dateValidator(start).between(start, end).getError()).toBe('');
    });

    it('should pass when date equals end', () => {
      expect(dateValidator(end).between(start, end).getError()).toBe('');
    });

    it('should pass when date is in range', () => {
      expect(dateValidator(middle).between(start, end).getError()).toBe('');
    });

    it('should fail when date is before range', () => {
      const error = dateValidator(pastDate).between(start, end).getError();
      expect(error).toContain('Must be between');
    });

    it('should fail when date is after range', () => {
      const error = dateValidator(futureDate).between(start, end).getError();
      expect(error).toContain('Must be between');
    });

    it('should accept strings as range bounds', () => {
      expect(dateValidator(middle).between('2024-01-01', '2024-12-31').getError()).toBe('');
    });
  });

  describe('past', () => {
    it('should pass for past date', () => {
      expect(dateValidator(pastDate).past().getError()).toBe('');
    });

    it('should fail for future date', () => {
      expect(dateValidator(futureDate).past().getError()).toBe('Must be in the past');
    });
  });

  describe('future', () => {
    it('should pass for future date', () => {
      expect(dateValidator(futureDate).future().getError()).toBe('');
    });

    it('should fail for past date', () => {
      expect(dateValidator(pastDate).future().getError()).toBe('Must be in the future');
    });
  });

  describe('weekday', () => {
    it('should pass for Monday', () => {
      expect(dateValidator(new Date('2024-01-08')).weekday().getError()).toBe(''); // Monday
    });

    it('should pass for Friday', () => {
      expect(dateValidator(new Date('2024-01-12')).weekday().getError()).toBe(''); // Friday
    });

    it('should fail for Saturday', () => {
      expect(dateValidator(new Date('2024-01-13')).weekday().getError()).toBe('Must be a weekday'); // Saturday
    });

    it('should fail for Sunday', () => {
      expect(dateValidator(new Date('2024-01-14')).weekday().getError()).toBe('Must be a weekday'); // Sunday
    });
  });

  describe('weekend', () => {
    it('should pass for Saturday', () => {
      expect(dateValidator(new Date('2024-01-13')).weekend().getError()).toBe(''); // Saturday
    });

    it('should pass for Sunday', () => {
      expect(dateValidator(new Date('2024-01-14')).weekend().getError()).toBe(''); // Sunday
    });

    it('should fail for Monday', () => {
      expect(dateValidator(new Date('2024-01-08')).weekend().getError()).toBe('Must be a weekend'); // Monday
    });

    it('should fail for Friday', () => {
      expect(dateValidator(new Date('2024-01-12')).weekend().getError()).toBe('Must be a weekend'); // Friday
    });
  });

  describe('minAge', () => {
    it('should pass when date is old enough', () => {
      const twentyYearsAgo = new Date();
      twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20);
      expect(dateValidator(twentyYearsAgo).minAge(18).getError()).toBe('');
    });

    it('should pass when date is exactly at minimum age', () => {
      const eighteenYearsAgo = new Date();
      eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
      expect(dateValidator(eighteenYearsAgo).minAge(18).getError()).toBe('');
    });

    it('should fail when date is too recent', () => {
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      expect(dateValidator(tenYearsAgo).minAge(18).getError()).toBe('Must be at least 18 years ago');
    });
  });

  describe('maxAge', () => {
    it('should pass when date is recent enough', () => {
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      expect(dateValidator(tenYearsAgo).maxAge(18).getError()).toBe('');
    });

    it('should pass when date is exactly at maximum age', () => {
      const eighteenYearsAgo = new Date();
      eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
      expect(dateValidator(eighteenYearsAgo).maxAge(18).getError()).toBe('');
    });

    it('should fail when date is too old', () => {
      const thirtyYearsAgo = new Date();
      thirtyYearsAgo.setFullYear(thirtyYearsAgo.getFullYear() - 30);
      expect(dateValidator(thirtyYearsAgo).maxAge(18).getError()).toBe('Must be at most 18 years ago');
    });
  });

  describe('invalid date handling', () => {
    it('should skip before validation for invalid date', () => {
      expect(dateValidator('invalid').before(referenceDate).getError()).toBe('');
    });

    it('should skip after validation for invalid date', () => {
      expect(dateValidator('invalid').after(referenceDate).getError()).toBe('');
    });

    it('should skip between validation for invalid date', () => {
      expect(dateValidator('invalid').between(pastDate, futureDate).getError()).toBe('');
    });

    it('should skip past validation for invalid date', () => {
      expect(dateValidator('invalid').past().getError()).toBe('');
    });

    it('should skip future validation for invalid date', () => {
      expect(dateValidator('invalid').future().getError()).toBe('');
    });
  });

  describe('method chaining', () => {
    it('should return first error only', () => {
      expect(dateValidator('invalid').required().past().getError()).toBe('Required');
    });

    it('should chain multiple validations successfully', () => {
      expect(dateValidator(pastDate).required().past().getError()).toBe('');
    });
  });
});
