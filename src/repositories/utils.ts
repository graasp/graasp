export enum OpEntryNotFound {
  CREATE = 'insertion',
  UPDATE = 'update',
  DELETE = 'deletion',
}

export const EntryNotFoundFactory = (className: string, op: OpEntryNotFound) => {
  return `The ${op} of a new ${className} failed, the entry was not found.`;
};
