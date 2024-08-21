import { DatabaseError } from 'pg-protocol';
import { BaseEntity, QueryFailedError } from 'typeorm';

import { BaseLogger } from '../logger';
import { Entity } from './AbstractRepository';
import { EntityConflictException, EntityConstrainstException } from './errors';
import { PostgresError } from './postgresErrors';

const isQueryFailedError = (err: unknown): err is QueryFailedError & DatabaseError =>
  err instanceof QueryFailedError;

export const errorFactory = <T extends BaseEntity>({
  logger,
  error,
  classEntity,
  fallBackError,
}: {
  logger: BaseLogger;
  error: unknown & { message?: string };
  classEntity: Entity<T>;
  fallBackError?: unknown;
}) => {
  if (isQueryFailedError(error)) {
    logger.error(error.message);
    switch (error.code) {
      case PostgresError.CheckViolation:
      case PostgresError.ForeignKeyViolation:
      case PostgresError.IntegrityConstraintViolation:
      case PostgresError.NotNullViolation:
        return new EntityConstrainstException(classEntity);
      case PostgresError.UniqueViolation:
        return new EntityConflictException(classEntity);
      default: {
        if (fallBackError) {
          return fallBackError;
        }
      }
    }
  }

  logger.error(`An error occured in the ${classEntity.name}Repository`, error.message ?? error);

  return error;
};
