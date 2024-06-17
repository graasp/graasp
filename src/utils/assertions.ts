import { UnexpectedError } from './errors';

/**
 * Throw an error if the object is undefined. Otherwise, return the object in a not-undefined type.
 * @param object Object to check
 * @param error Error to throw if the object is undefined
 * @returns Object in a not-undefined type
 */
export function notUndefined<T>(object: T | undefined, error?: Error): T {
  if (!object) {
    throw error || new UnexpectedError();
  }
  return object;
}
