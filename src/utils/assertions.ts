import { UnexpectedError } from './errors';

export type Nullable<T> = T | null | undefined;

/**
 *  Returns true if the object is not null or undefined.
 * @param object Object to check
 * @returns True if the object is not null or undefined, false otherwise
 */
export function isDefined<T>(object: Nullable<T>): object is T {
  return object !== null && object !== undefined;
}

/**
 * Throw an error if the object is undefined or null. Otherwise, return the object in a not-undefined type.
 * @param object Object to check
 * @param error Error to throw if the object is undefined or null
 * @returns Object in a not-undefined type
 */
export function asDefined<T, Err extends Error, Args extends unknown[]>(
  object: Nullable<T>,
  error?: new (...args: Args) => Err,
  ...args: Args
): T {
  if (isDefined(object)) {
    return object;
  }
  throw error ? new error(...args) : new UnexpectedError();
}

/**
 * Throw an error if the object is either undefined or null.
 * @param object Object to check
 * @param error Error class to throw if the object is undefined or null
 * @param args Arguments to pass to the error class constructor
 */
export function assertIsDefined<T, Err extends Error, Args extends unknown[]>(
  object: Nullable<T>,
  error?: new (...args: Args) => Err,
  ...args: Args
): asserts object is NonNullable<T> {
  if (!isDefined(object)) {
    throw error ? new error(...args) : new UnexpectedError();
  }
}
