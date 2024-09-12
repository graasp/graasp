import { asDefined } from '../assertions';
import { UndefinedVariableError } from './errors';
import { Validator, Variable } from './types';

function readEnv(envName: string): Variable {
  return {
    name: envName,
    value: process.env[envName],
  };
}

export function validateVar(
  variable: Variable,
  validator: Validator,
  ...moreValidators: Validator[]
): string {
  // using validator and moreValidators allow to enforce at least one Validator.
  const validators = [validator, ...moreValidators];

  const { value } = validators.reduce(
    (prevVar, validator) => validator.validate(prevVar),
    variable,
  );

  // this should never happen.
  if (!value) {
    throw new Error('Something goes wrong with the validators.');
  }

  return value;
}

export function validateEnv(
  envName: string,
  validator: Validator,
  ...moreValidators: Validator[]
): string {
  return validateVar(readEnv(envName), validator, ...moreValidators);
}

export function valueShouldBeDefined<T>(name: string, value?: T) {
  return asDefined(value, UndefinedVariableError, name);
}

export function urlContainsProtocol(url: string) {
  return url.startsWith('http://') || url.startsWith('https://');
}
