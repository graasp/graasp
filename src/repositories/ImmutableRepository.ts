import {
  BaseEntity,
  DeepPartial,
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  In,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';

import { KeysOfString } from '../types';
import { assertIsError } from '../utils/assertions';
import { isDuplicateEntryError } from '../utils/typeormError';
import { AbstractRepository, Entity } from './AbstractRepository';
import {
  EntityNotFound,
  EntryNotFoundAfterInsertException,
  IllegalArgumentException,
  InsertionException,
} from './errors';

type CreateBody<T extends BaseEntity> = DeepPartial<T> | { [key: string]: unknown };

/**
 * Abstract class representing a repository for immutable entities.
 * Extends the AbstractRepository class to provide additional functionality for adding and retrieving entities.
 *
 * @template T The type of the entity.
 */
export abstract class ImmutableRepository<T extends BaseEntity> extends AbstractRepository<T> {
  /** The primary key of the entity used during the find. */
  protected readonly primaryKeyName: KeysOfString<T>;
  protected readonly entity: Entity<T>;

  /**
   * @param primaryKeyName The name of the entity's primary key, used during the findOne.
   * @param entity The concrete entity the repository will manage.
   * @param manager The entity manager used to handle transactions.
   */
  constructor(primaryKeyName: KeysOfString<T>, entity: Entity<T>, manager?: EntityManager) {
    super(entity, manager);
    this.entity = entity;
    this.primaryKeyName = primaryKeyName;
  }

  /********************************** Public Interfaces **********************************/
  /**
   * Adds a new entity to the repository using the provided body.
   *
   * @param body The body containing the entity data.
   * @returns A promise that resolves to the newly created entity.
   */
  public abstract addOne(body: CreateBody<T>): Promise<T>;

  /**
   * Retrieves an entity with the specified primary key.
   *
   * @param pkValue The value of the entity's primary key to retrieve.
   * @param options Allows to includes the deleted entities if needed.
   * @returns A promise that resolves to the entity if found, or null if not found.
   */
  public async getOne(
    pkValue: string,
    options: Pick<FindOneOptions<T>, 'withDeleted'> = { withDeleted: false },
  ): Promise<T | null> {
    return await this.findOne(pkValue, options);
  }

  /**
   * Retrieves an entity with the specified primary key or throws if not found.
   *
   * @param pkValue The value of the entity's primary key to retrieve.
   * @param options Allows to includes the deleted entities if needed.
   * @param errorToThrow The error to throw. If undefined, throws EntityNotFound.
   * @returns A promise that resolves to the entity.
   * @throws errorToThrow or EntityNotFound if the entity was not found.
   */
  public async getOneOrThrow(
    pkValue: string,
    options: Pick<FindOneOptions<T>, 'withDeleted'> = { withDeleted: false },
    errorToThrow?: Error,
  ): Promise<T> {
    const entity = await this.getOne(pkValue, options);

    if (!entity) {
      const error = errorToThrow ?? new EntityNotFound(this.entity, pkValue);
      throw error;
    }

    return entity;
  }

  public getMultiple(
    pkValues: string[],
    options: Pick<FindManyOptions<T>, 'withDeleted'> = { withDeleted: false },
  ): Promise<T[]> {
    this.throwsIfPKIsInvalid(pkValues);

    return this.repository.find({
      where: {
        [this.primaryKeyName]: In(pkValues),
      } as FindOptionsWhere<T>,
      ...options,
    });
  }

  /********************************** Subclass Methods **********************************/
  /**
   * Throws an IllegalArgumentException if the given primary key is undefined or an empty array.
   *
   * @param pkValue The primary key to check.
   * @throws IllegalArgumentException if the primary key is invalid.
   */
  protected throwsIfPKIsInvalid(pkValue: string | string[]) {
    this.throwsIfParamIsInvalid(String(this.primaryKeyName), pkValue);
  }

  /**
   * Throws an IllegalArgumentException if the given parameter is undefined or an empty array.
   *
   * @param name The name of the parameter to check.
   * @param value The value of the parameter.
   * @throws IllegalArgumentException if the parameter is invalid.
   */
  protected throwsIfParamIsInvalid(name: string, value: string | string[]) {
    if (!value) {
      throw new IllegalArgumentException(`The given ${name} is undefined!`);
    }

    if (Array.isArray(value) && (value.length === 0 || value.some((v) => !v))) {
      throw new IllegalArgumentException(`The given array of ${name} is empty!`);
    }
  }

  /**
   * Finds a single entity with the specified primary key and optional options.
   *
   * @param pkValue The value of the entity's primary key to find.
   * @param options Optional options for finding the entity, such as relations, join, withDeleted, select, and order.
   * @throws IllegalArgumentException if the given PK is undefined or empty.
   * @returns A promise that resolves to the found entity, or null if not found.
   */
  protected async findOne(
    pkValue: string,
    options: Pick<
      FindOneOptions<T>,
      'relations' | 'join' | 'withDeleted' | 'select' | 'order'
    > = {},
  ): Promise<T | null> {
    this.throwsIfPKIsInvalid(pkValue);

    return await this.repository.findOne({
      where: {
        [this.primaryKeyName]: pkValue,
      } as FindOptionsWhere<T>,
      ...options,
    });
  }

  /**
   * Inserts a new entity into the repository.
   *
   * @param entity The entity data to insert.
   * @throws EntryNotFoundAfterInsertException if the inserted entity is not found.
   * @returns A promise that resolves to the inserted entity.
   */
  protected async insert(entity: DeepPartial<T>): Promise<T> {
    try {
      const insertResult = await this.repository.insert(entity as QueryDeepPartialEntity<T>);
      const insertedEntity = await this.getOne(insertResult.identifiers[0][this.primaryKeyName]);

      // Should never happen, if an error occurs, it should throw during the insert.
      if (!insertedEntity) {
        throw new EntryNotFoundAfterInsertException(this.entity);
      }

      return insertedEntity;
    } catch (e) {
      if (e instanceof EntryNotFoundAfterInsertException) {
        throw e;
      }
      assertIsError(e);
      if (isDuplicateEntryError(e)) {
        throw e;
      }
      throw new InsertionException(e.message);
    }
  }

  protected async insertMany(entities: DeepPartial<T>[]): Promise<T[]> {
    try {
      const insertResults = await this.repository.insert(entities as QueryDeepPartialEntity<T>[]);
      const insertedKeys = insertResults.identifiers.map(
        (identifier) => identifier[this.primaryKeyName],
      ) as string[];
      const insertedEntities = await this.getMultiple(insertedKeys);

      // Should never happen, if an error occurs, it should throw during the insert.
      if (!insertedEntities || insertedEntities.length !== insertResults.identifiers.length) {
        throw new EntryNotFoundAfterInsertException(this.entity);
      }

      return insertedEntities;
    } catch (e) {
      if (e instanceof EntryNotFoundAfterInsertException) {
        throw e;
      }
      throw new InsertionException(e);
    }
  }
}
