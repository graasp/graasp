import { UnexpectedError } from './errors';

/**
 * Throw an error if the object is undefined. Otherwise, return the object in a not-undefined type.
 * @param object Object to check
 * @param error Error to throw if the object is undefined
 * @returns Object in a not-undefined type
 */
export function notUndefined<T>(object: T | undefined, error?: Error): T {
  if (object === undefined) {
    throw error || new UnexpectedError();
  }
  return object;
}

/**
 * Throw an error if the object is either undefined or null.
 * @param object Object to check
 * @param error Error class to throw if the object is undefined or null
 * @param args Arguments to pass to the error class constructor
 */
export function assertNonNull<T, Err extends Error, Args extends unknown[]>(
  object: T | null,
  error?: new (...args: Args) => Err,
  ...args: Args
): asserts object is NonNullable<T> {
  if (object === undefined || object === null) {
    throw error ? new error(...args) : new UnexpectedError();
  }
}
