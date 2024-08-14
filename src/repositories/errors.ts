import { BaseEntity } from 'typeorm';

import { Entity } from './AbstractRepository';
import { EntryNotFoundFactory, OpEntryNotFound } from './utils';

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
  constructor(classEntity: Entity<T>) {
    super(
      EntryNotFoundFactory(classEntity.name, OpEntryNotFound.CREATE),
      'EntryNotFoundAfterInsertException',
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
  constructor(classEntity: Entity<T>) {
    super(
      EntryNotFoundFactory(classEntity.name, OpEntryNotFound.UPDATE),
      'EntryNotFoundAfterUpdateException',
    );
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

/**
 * Thrown to indicate that the database delete has failed because the entity was not found.
 */
export class EntryNotFoundBeforeDeleteException<T extends BaseEntity> extends RepositoryException {
  constructor(classEntity: Entity<T>) {
    super(
      EntryNotFoundFactory(classEntity.name, OpEntryNotFound.DELETE),
      'EntryNotFoundBeforeDeleteException',
    );
  }
}

/**
 * Thrown to indicate that the entity was not found.
 */
export class EntityNotFound<T extends BaseEntity> extends RepositoryException {
  constructor(classEntity: Entity<T>, primaryKeyValue: string) {
    super(`The ${classEntity.name} ${primaryKeyValue} was not found!`, 'EntityNotFound');
  }
}
