import { BaseEntity, DeepPartial, EntityManager, FindOptionsWhere } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';

import { KeysOfString } from '../types';
import { Entity } from './AbstractRepository';
import { ImmutableRepository } from './ImmutableRepository';
import { errorFactory } from './errorFactory';
import {
  DeleteException,
  EntryNotFoundAfterUpdateException,
  EntryNotFoundBeforeDeleteException,
  UpdateException,
} from './errors';

/**
 * Abstract class representing a repository for mutable entities.
 * Extends the ImmutableRepository class to provide additional functionality for updating and deleting entities.
 *
 * @template T The type of the entity.
 * @template UpdateBody The type of the body used for updating entities.
 */
export abstract class MutableRepository<
  T extends BaseEntity,
  // We use Generics in UpdateBody to ensure subclasses provide a specific body for default implementations.
  UpdateBody extends DeepPartial<T> | { [key: string]: unknown },
> extends ImmutableRepository<T> {
  /**
   * @param primaryKeyName The name of the entity's primary key, used during the findOne.
   * @param entity The concrete entity the repository will manage.
   * @param manager The entity manager used to handle transactions.
   */
  constructor(primaryKeyName: KeysOfString<T>, entity: Entity<T>, manager?: EntityManager) {
    super(primaryKeyName, entity, manager);
  }

  /**
   * Updates an entity with the given primary key and partial entity data.
   *
   * @param pkValue The value of the entity's primary key to update.
   * @param entity The partial entity data containing the updated properties.
   * @throws IllegalArgumentException if the given PK is undefined or empty.
   */
  public async updateOne(pkValue: string, entity: UpdateBody): Promise<T> {
    this.throwsIfPKIsInvalid(pkValue);

    try {
      await this.repository.update(
        {
          [this.primaryKeyName]: pkValue,
        } as FindOptionsWhere<T>,
        entity as QueryDeepPartialEntity<T>,
      );

      const updatedEntity = await this.getOne(pkValue);

      // This can happen if the given pk doesn't exist.
      if (!updatedEntity) {
        throw new EntryNotFoundAfterUpdateException(this.classEntity);
      }

      return updatedEntity;
    } catch (e) {
      throw errorFactory<T>({
        error: e,
        classEntity: this.classEntity,
        fallBackError: new UpdateException({ message: e.message, classEntity: this.classEntity }),
      });
    }
  }

  /**
   * Deletes one or multiple entities with the specified primary key(s).
   *
   * @param pkValue The value of the entity's primary key to delete.
   * @throws IllegalArgumentException if the given PK is undefined or empty.
   */
  public async delete(pkValue: string | string[]): Promise<void> {
    this.throwsIfPKIsInvalid(pkValue);

    try {
      await this.repository.delete(pkValue);
    } catch (e) {
      throw errorFactory<T>({
        error: e,
        classEntity: this.classEntity,
        fallBackError: new DeleteException({ message: e.message, classEntity: this.classEntity }),
      });
    }
  }

  /**
   * Deletes one entity with the specified primary key and return it.
   *
   * @param pkValue The value of the entity's primary key to delete.
   * @returns The removed entity.
   * @throws IllegalArgumentException if the given PK is undefined or empty.
   */
  public async deleteOne(pkValue: string): Promise<T> {
    this.throwsIfPKIsInvalid(pkValue);

    const entity = await this.getOne(pkValue);

    if (!entity) {
      throw new EntryNotFoundBeforeDeleteException(this.classEntity);
    }

    try {
      await this.repository.delete(pkValue);
      return entity;
    } catch (e) {
      throw errorFactory<T>({
        error: e,
        classEntity: this.classEntity,
        fallBackError: new DeleteException({ message: e.message, classEntity: this.classEntity }),
      });
    }
  }
}
