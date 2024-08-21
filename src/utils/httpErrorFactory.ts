import {
  EntityNotFound,
  EntryNotFoundAfterInsertException,
  EntryNotFoundAfterUpdateException,
  EntryNotFoundBeforeDeleteException,
} from '../repositories/errors';

const ERRORS_NOT_FOUND = [
  EntityNotFound,
  EntryNotFoundAfterInsertException,
  EntryNotFoundAfterUpdateException,
  EntryNotFoundBeforeDeleteException,
];

type ErrorsToThrow = { notFoundError: unknown };
/**
 * Transforms errors (like Repository errors) into HTTP errors.
 * @param error The original error.
 * @param errorsToThrow A map of errors to throw depending on the reason.
 * @returns The transformed error if exist, else the original error.
 */
export const httpErrorFactory = (error: unknown, { notFoundError }: ErrorsToThrow) => {
  switch (true) {
    case isErrorNotFound(error):
      return notFoundError;
    default:
      return error;
  }
};

const isErrorNotFound = (error: unknown) => ERRORS_NOT_FOUND.some((e) => error instanceof e);
