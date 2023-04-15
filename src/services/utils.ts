import { ResultOf } from '@graasp/sdk';
import crypto from 'crypto';

export function mapById<T>({
  keys,
  findElement,
  buildError,
}: {
  defaultValue?: T;
  keys: string[];
  findElement: (key: string) => T|undefined;
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

// const randomHexOf4 = () => ((Math.random() * (1 << 16)) | 0).toString(16).padStart(4, '0');
export const randomHexOf4 = () => crypto.randomBytes(2).toString('hex');
