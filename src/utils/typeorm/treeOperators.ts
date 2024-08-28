import { FindOperator } from 'typeorm';

export function AncestorOf<T>(value: T | FindOperator<T>): FindOperator<T> {
  return new FindOperator('arrayContains', value); // Correspond to '@>' operator
}

export function DescendantOf<T>(value: T | FindOperator<T>): FindOperator<T> {
  return new FindOperator('arrayContainedBy', value); // Correspond to '<@' operator
}
