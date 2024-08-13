import {
  BaseEntity,
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindOneOptions,
  FindOptionsRelations,
  FindOptionsWhere,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';

import { KeysOfString } from '../types';
import { AbstractRepository } from './AbstractRepository';
import {
  EntryNotFoundAfterInsertException,
  IllegalArgumentException,
  InsertionException,
} from './errors';

type CreateBody<T extends BaseEntity> = DeepPartial<T>;

/**
 * Abstract class representing a repository for immutable entities.
 * Extends the AbstractRepository class to provide additional functionality for adding and retrieving entities.
 *
 * @template T The type of the entity.
 */
export abstract class ImmutableRepository<T extends BaseEntity> extends AbstractRepository<T> {
  /** The primary key of the entity used during the find. */
  protected readonly primaryKeyName: KeysOfString<T>;

  /**
   * @param primaryKeyName The name of the entity's primary key, used during the findOne.
   * @param entity The concrete entity the repository will manage.
   * @param manager The entity manager used to handle transactions.
   */
  constructor(primaryKeyName: KeysOfString<T>, entity: EntityTarget<T>, manager?: EntityManager) {
    super(entity, manager);
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
   * @returns A promise that resolves to the entity if found, or null if not found.
   */
  public async getOne(pkValue: string): Promise<T | null> {
    return await this.findOne(pkValue);
  }

  /********************************** Subclass Methods **********************************/
  /**
   * Throws an IllegalArgumentException if the given primary key is undefined or an empty array.
   *
   * @param pkValue The primary key to check.
   */
  protected throwsIfPKIsInvalid(pkValue: string | string[]) {
    if (!pkValue) {
      throw new IllegalArgumentException(`The given ${String(this.primaryKeyName)} is undefined!`);
    }

    if (Array.isArray(pkValue) && pkValue.length === 0) {
      throw new IllegalArgumentException(
        `The given array of ${String(this.primaryKeyName)} is empty!`,
      );
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
   * @param relations Optional relations to load with the inserted entity.
   * @throws EntryNotFoundAfterInsertException if the inserted entity is not found.
   * @returns A promise that resolves to the inserted entity.
   */
  protected async insert(entity: DeepPartial<T>, relations?: FindOptionsRelations<T>): Promise<T> {
    try {
      const insertResult = await this.repository.insert(entity as QueryDeepPartialEntity<T>);
      const insertedEntity = await this.findOne(insertResult.identifiers[0].id, { relations });

      // Should never happen, if an error occurs, it should throw during the insert.
      if (!insertedEntity) {
        throw new EntryNotFoundAfterInsertException(this.entity);
      }

      return insertedEntity;
    } catch (e) {
      if (e instanceof EntryNotFoundAfterInsertException) {
        throw e;
      }
      throw new InsertionException(e);
    }
  }
}
