import { RegexValidatorError, UndefinedVariableError, UrlMissingProtocolError } from './errors';
import {
  ERROR_CONTAIN_NUMBER,
  ERROR_NUMBER,
  containsNumberFiveValidator,
  numberValidator,
} from './fixtures';
import { validateVar } from './utils';
import { RegexValidator, RequiredValidator, UrlValidator } from './validators';

describe('Test Validators', () => {
  describe('UrlValidator', () => {
    const urlValidator = new UrlValidator();

    it('Undefined variable should', () => {
      expect(() =>
        validateVar(
          {
            name: 'TestVariable',
            value: undefined,
          },
          urlValidator,
        ),
      ).toThrow(UndefinedVariableError);
    });

    it('Missing URL protocol should throw', () => {
      expect(() =>
        validateVar(
          {
            name: 'TestVariable',
            value: 'localhost',
          },
          urlValidator,
        ),
      ).toThrow(UrlMissingProtocolError);
    });

    it('URL variable with HTTP protocol should not throw', () => {
      expect(() =>
        validateVar(
          {
            name: 'TestVariable',
            value: 'http://localhost:9000',
          },
          urlValidator,
        ),
      ).not.toThrow();
    });

    it('URL variable with HTTPS protocol should not throw', () => {
      expect(() =>
        validateVar(
          {
            name: 'TestVariable',
            value: 'https://localhost:9000',
          },
          urlValidator,
        ),
      ).not.toThrow();
    });
  });

  describe('RequiredValidator', () => {
    const requiredValidator = new RequiredValidator();
    it('Undefined variable should throw if RequiredValidator is used', () => {
      expect(() =>
        validateVar(
          {
            name: 'TestVariable',
            value: undefined,
          },
          requiredValidator,
        ),
      ).toThrow(UndefinedVariableError);
    });

    it('Empty variable should throw if RequiredValidator is used', () => {
      expect(() =>
        validateVar(
          {
            name: 'TestVariable',
            value: undefined,
          },
          requiredValidator,
        ),
      ).toThrow(UndefinedVariableError);
    });

    it('Defined variable should not throw', () => {
      expect(() =>
        validateVar(
          {
            name: 'TestVariable',
            value: 'ok',
          },
          requiredValidator,
        ),
      ).not.toThrow();
    });
  });

  describe('RegexValidator', () => {
    const regexValidator = new RegexValidator(/^[a-f\d]{64}$/);
    it('Invalid regex should throw', () => {
      expect(() =>
        validateVar(
          {
            name: 'TestVariable',
            value: 'invalid',
          },
          regexValidator,
        ),
      ).toThrow(RegexValidatorError);
    });

    it('Valid regex should not throw', () => {
      const validID = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      expect(() =>
        validateVar(
          {
            name: 'TestVariable',
            value: validID,
          },
          regexValidator,
        ),
      ).not.toThrow();
    });
  });

  describe('Test multiple validators', () => {
    // Dummies validators just to test the chain of validation
    const isNumberValidator = numberValidator;
    const containsFiveValidator = containsNumberFiveValidator(5);
    const containsZeroValidator = containsNumberFiveValidator(0);

    const varName = 'TestVariable';

    it('An invalid number should throw', () => {
      expect(() =>
        validateVar(
          {
            name: varName,
            value: 'NotANumber',
          },
          isNumberValidator,
          containsFiveValidator,
          containsZeroValidator,
        ),
      ).toThrow(ERROR_NUMBER);
    });

    it('A valid number without "5" should throw', () => {
      expect(() =>
        validateVar(
          {
            name: varName,
            value: '4',
          },
          isNumberValidator,
          containsFiveValidator,
          containsZeroValidator,
        ),
      ).toThrow(ERROR_CONTAIN_NUMBER(varName, 5));
    });

    it('A valid number without "0" should throw', () => {
      expect(() =>
        validateVar(
          {
            name: varName,
            value: '51',
          },
          isNumberValidator,
          containsFiveValidator,
          containsZeroValidator,
        ),
      ).toThrow(ERROR_CONTAIN_NUMBER(varName, 0));
    });

    it('A valid number with "5" and "0" should not throw', () => {
      expect(() =>
        validateVar(
          {
            name: varName,
            value: '509',
          },
          isNumberValidator,
          containsFiveValidator,
          containsZeroValidator,
        ),
      ).not.toThrow();
    });
  });
});
