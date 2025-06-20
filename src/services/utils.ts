import crypto from 'crypto';

import type { ResultOf } from '@graasp/sdk';

export function mapById<T>({
  keys,
  findElement,
  buildError,
}: {
  defaultValue?: T;
  keys: string[];
  findElement: (key: string) => T | undefined;
  buildError?: (key: string) => Error;
}): ResultOf<T> {
  const data: { [key: string]: T } = {};
  const errors: Error[] = [];
  keys.forEach((key) => {
    const m = findElement(key);
    if (m) {
      data[key] = m;
    }
    // else if(defaultValue) {
    //   data[key] = defaultValue;
    // }
    else if (buildError) {
      errors.push(buildError(key));
    }
  });
  return { data, errors };
}

export function resultOfToList<T>(resultOf: ResultOf<T>): T[] {
  return Object.values(resultOf.data);
}

// Use a cryptographically secure way to generate randomness
export const randomHexOf4 = () => crypto.randomBytes(2).toString('hex');

export function convertToValidFilename(str: string) {
  return str.replace(/[\/|\\:*?"<>\s]/g, '_');
}
