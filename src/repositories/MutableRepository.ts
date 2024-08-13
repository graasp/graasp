import { BaseEntity, DeepPartial, EntityManager, EntityTarget, FindOptionsWhere } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';

import { KeysOfString } from '../types';
import { ImmutableRepository } from './ImmutableRepository';
import { DeleteException, EntryNotFoundAfterUpdateException, UpdateException } from './errors';

/**
 * Abstract class representing a repository for mutable entities.
 * Extends the ImmutableRepository class to provide additional functionality for updating and deleting entities.
 *
 * @template T The type of the entity.
 * @template UpdateBody The type of the body used for updating entities.
 */
export abstract class MutableRepository<
  T extends BaseEntity,
  UpdateBody extends DeepPartial<T>,
> extends ImmutableRepository<T> {
  /**
   * @param primaryKeyName The name of the entity's primary key, used during the findOne.
   * @param entity The concrete entity the repository will manage.
   * @param manager The entity manager used to handle transactions.
   */
  constructor(primaryKeyName: KeysOfString<T>, entity: EntityTarget<T>, manager?: EntityManager) {
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

      const udpatedEntity = await this.findOne(pkValue);

      // Should never happen, if an error occurs, it should throw during the update.
      if (!udpatedEntity) {
        throw new EntryNotFoundAfterUpdateException(this.entity);
      }

      return udpatedEntity;
    } catch (e) {
      if (e instanceof EntryNotFoundAfterUpdateException) {
        throw e;
      }
      throw new UpdateException(e);
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
      throw new DeleteException(e);
    }
  }
}
