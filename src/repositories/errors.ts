import { BaseEntity, EntityTarget } from 'typeorm';

abstract class RepositoryException extends Error {
  constructor(message: string, name: string) {
    super(message);
    this.message = message;
    this.name = name;
  }
}

/**
 * Thrown to indicate that a method has been passed an illegal or inappropriate argument.
 */
export class IllegalArgumentException extends RepositoryException {
  constructor(message: string) {
    super(message, 'IllegalArgumentException');
  }
}

/**
 * Thrown to indicate that the database insertion has failed.
 */
export class InsertionException extends RepositoryException {
  constructor(message: string) {
    super(message, 'InsertionException');
  }
}

/**
 * Thrown to indicate that the database insertion has failed because the returned id was not found.
 */
export class EntryNotFoundAfterInsertException<T extends BaseEntity> extends RepositoryException {
  constructor(entity: EntityTarget<T>) {
    super(
      `The insertion of a new ${entity} failed, the created id was not found.`,
      'InsertionException',
    );
  }
}

/**
 * Thrown to indicate that the database update has failed.
 */
export class UpdateException extends RepositoryException {
  constructor(message: string) {
    super(message, 'UpdateException');
  }
}

/**
 * Thrown to indicate that the database update has failed because the entity was not found.
 */
export class EntryNotFoundAfterUpdateException<T extends BaseEntity> extends RepositoryException {
  constructor(entity: EntityTarget<T>) {
    super(`The update of ${entity} failed, the id was not found.`, 'InsertionException');
  }
}

/**
 * Thrown to indicate that the database delete has failed.
 */
export class DeleteException extends RepositoryException {
  constructor(message: string) {
    super(message, 'DeleteException');
  }
}
