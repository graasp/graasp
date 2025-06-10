import type { Validator, Variable } from './types';

// Defines dummy validators to test chain of validation
export const ERROR_NUMBER = 'The given value is not a number!';
export const numberValidator: Validator<string> = {
  validate: ({ name, value }: Variable) => {
    if (!value || !Number(value)) {
      throw new Error(ERROR_NUMBER);
    }

    return { name, value };
  },
};

export const ERROR_CONTAIN_NUMBER = (name: string, num: number) =>
  `The variable ${name} does not contain "${num}"!`;
export const containsNumberFiveValidator = (num: number): Validator<string> => ({
  validate: ({ name, value }: Variable) => {
    if (!value || !value.includes(num.toString())) {
      throw new Error(ERROR_CONTAIN_NUMBER(name, num));
    }

    return { name, value };
  },
});
