import { DatabaseError } from 'pg-protocol';
import { BaseEntity, QueryFailedError } from 'typeorm';

import { Entity } from './AbstractRepository';
import { EntityConflictException, EntityConstraintException } from './errors';
import { PostgresError } from './postgresErrors';

const isQueryFailedError = (err: unknown): err is QueryFailedError & DatabaseError =>
  err instanceof QueryFailedError;

export const errorFactory = <T extends BaseEntity>({
  error,
  classEntity,
  fallBackError,
}: {
  error: { message?: string };
  classEntity: Entity<T>;
  fallBackError?: unknown;
}) => {
  if (isQueryFailedError(error)) {
    switch (error.code) {
      case PostgresError.CheckViolation:
      case PostgresError.ForeignKeyViolation:
      case PostgresError.IntegrityConstraintViolation:
      case PostgresError.NotNullViolation:
        return new EntityConstraintException(classEntity);
      case PostgresError.UniqueViolation:
        return new EntityConflictException(classEntity);
      default: {
        if (fallBackError) {
          return fallBackError;
        }
      }
    }
  }

  return error;
};
