import { IllegalArgumentException } from './errors';

export enum OpEntryNotFound {
  CREATE = 'insertion',
  UPDATE = 'update',
  DELETE = 'deletion',
}

export const EntryNotFoundFactory = (className: string, op: OpEntryNotFound) => {
  return `The ${op} of a new ${className} failed, the entry was not found.`;
};

export function throwsIfParamIsInvalid(name: string, value: string | string[]) {
  if (!value) {
    throw new IllegalArgumentException(`The given ${name} is undefined!`);
  }

  if (Array.isArray(value) && (value.length === 0 || value.some((v) => !v))) {
    throw new IllegalArgumentException(`The given array of ${name} is empty!`);
  }
}
