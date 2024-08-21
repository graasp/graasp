import { BaseEntity } from 'typeorm';

import { Entity } from './AbstractRepository';
import { EntryNotFoundFactory, OpEntryNotFound } from './utils';

type RepositoryExceptionConstructor<T extends BaseEntity> = {
  message: string;
  name: string;
  classEntity: Entity<T>;
  data?: unknown;
};

abstract class RepositoryException<T extends BaseEntity> extends Error {
  public readonly data: unknown;
  public readonly classEntity: string;

  constructor({ message, name, classEntity, data }: RepositoryExceptionConstructor<T>) {
    super(message);
    this.message = message;
    this.name = name;
    this.classEntity = classEntity.name;
    this.data = data;
  }
}

/** Thrown to indicate that a method has been passed an illegal or inappropriate argument. */
export class IllegalArgumentException<T extends BaseEntity> extends RepositoryException<T> {
  constructor(message: string, classEntity: Entity<T>) {
    super({ message, name: 'IllegalArgumentException', classEntity });
  }
}

/**
 * Thrown to indicate that the database insertion has failed.
 */
export class InsertionException<T extends BaseEntity> extends RepositoryException<T> {
  constructor({
    message,
    classEntity,
    name,
  }: {
    message: string;
    classEntity: Entity<T>;
    name?: string;
  }) {
    super({ message, name: name ?? 'InsertionException', classEntity });
  }
}

/** Thrown to indicate that the entity already exist in the database. */
export class EntityConflictException<T extends BaseEntity> extends InsertionException<T> {
  constructor(classEntity: Entity<T>) {
    super({
      message: `This ${classEntity.name} already exist!`,
      name: 'EntityConflictException',
      classEntity,
    });
  }
}

/** Thrown to indicate that the entity was not inserted/updated in the database due to a constraint violation. */
export class EntityConstraintException<T extends BaseEntity> extends InsertionException<T> {
  constructor(classEntity: Entity<T>) {
    super({
      message: `This ${classEntity.name} was not saved in the database due to the violation of a constraint!`,
      name: 'EntityConstraintException',
      classEntity,
    });
  }
}

/** Thrown to indicate that the database insertion has failed because the returned id was not found. */
export class EntryNotFoundAfterInsertException<T extends BaseEntity> extends InsertionException<T> {
  constructor(classEntity: Entity<T>) {
    super({
      message: EntryNotFoundFactory(classEntity.name, OpEntryNotFound.CREATE),
      name: 'EntryNotFoundAfterInsertException',
      classEntity,
    });
  }
}

/** Thrown to indicate that the database update has failed. */
export class UpdateException<T extends BaseEntity> extends RepositoryException<T> {
  constructor({
    message,
    classEntity,
    name,
  }: {
    message: string;
    classEntity: Entity<T>;
    name?: string;
  }) {
    super({ message, name: name ?? 'UpdateException', classEntity });
  }
}

/** Thrown to indicate that the database update has failed because the entity was not found. */
export class EntryNotFoundAfterUpdateException<T extends BaseEntity> extends UpdateException<T> {
  constructor(classEntity: Entity<T>) {
    super({
      message: EntryNotFoundFactory(classEntity.name, OpEntryNotFound.UPDATE),
      name: 'EntryNotFoundAfterUpdateException',
      classEntity,
    });
  }
}

/** Thrown to indicate that the database delete has failed. */
export class DeleteException<T extends BaseEntity> extends RepositoryException<T> {
  constructor({
    message,
    classEntity,
    name,
  }: {
    message: string;
    classEntity: Entity<T>;
    name?: string;
  }) {
    super({ message, name: name ?? 'DeleteException', classEntity });
  }
}

/** Thrown to indicate that the database delete has failed because the entity was not found. */
export class EntryNotFoundBeforeDeleteException<T extends BaseEntity> extends DeleteException<T> {
  constructor(classEntity: Entity<T>) {
    super({
      message: EntryNotFoundFactory(classEntity.name, OpEntryNotFound.DELETE),
      name: 'EntryNotFoundBeforeDeleteException',
      classEntity,
    });
  }
}

/** Thrown to indicate that the entity was not found. */
export class EntityNotFound<T extends BaseEntity> extends RepositoryException<T> {
  constructor(classEntity: Entity<T>, primaryKeyValue: string) {
    super({
      message: `The ${classEntity.name} ${primaryKeyValue} was not found!`,
      name: 'EntityNotFound',
      classEntity,
      data: primaryKeyValue,
    });
  }
}
