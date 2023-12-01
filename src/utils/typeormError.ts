import { QueryFailedError } from 'typeorm';

// find codes package??
export const DUPLICATE_ENTRY_ERROR_CODE = '23505';

/**
 * Check if the given error is due to duplication key in the database.
 * @param thrownError The thrown error.
 */
export const isDuplicateEntryError = (thrownError: Error) => {
  return (
    thrownError instanceof QueryFailedError &&
    thrownError.driverError.code === DUPLICATE_ENTRY_ERROR_CODE
  );
};
