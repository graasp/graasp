import { EntityManager } from 'typeorm';

import { ItemLoginSchemaType, getChildFromPath } from '@graasp/sdk';

import { MutableRepository } from '../../../repositories/MutableRepository';
import { DEFAULT_PRIMARY_KEY } from '../../../repositories/const';
import {
  DeleteException,
  EntityNotFound,
  EntryNotFoundBeforeDeleteException,
} from '../../../repositories/errors';
import { assertIsError } from '../../../utils/assertions';
import { AncestorOf } from '../../../utils/typeorm/treeOperators';
import { Item } from '../../item/entities/Item';
import { ItemLoginSchema } from '../entities/itemLoginSchema';
import { CannotNestItemLoginSchema } from '../errors';

type ItemPath = Item['path'];
type ItemId = Item['id'];
type CreateItemLoginSchemaBody = {
  itemPath: ItemPath;
  type?: ItemLoginSchema['type'];
};
type UpdateItemLoginSchemaBody = {
  type?: ItemLoginSchema['type'];
  status?: ItemLoginSchema['status'];
};

export class ItemLoginSchemaRepository extends MutableRepository<
  ItemLoginSchema,
  UpdateItemLoginSchemaBody
> {
  constructor(manager?: EntityManager) {
    super(DEFAULT_PRIMARY_KEY, ItemLoginSchema, manager);
  }

  async getOneByItemId(itemId: ItemId): Promise<ItemLoginSchema | null> {
    this.throwsIfParamIsInvalid('item', itemId);

    return await this.repository.findOne({
      where: { item: { id: itemId } },
    });
  }

  async getOneByItemPath(itemPath: ItemPath): Promise<ItemLoginSchema | null> {
    this.throwsIfParamIsInvalid('itemPath', itemPath);

    return await this.repository.findOne({
      where: { item: { path: AncestorOf(itemPath) } },
      relations: { item: true },
    });
  }

  async getOneByItemPathOrThrow<Err extends Error, Args extends unknown[]>(
    itemPath: ItemPath,
    errorToThrow?: new (...args: Args) => Err,
    ...errorArgs: Args
  ): Promise<ItemLoginSchema> {
    const entity = await this.getOneByItemPath(itemPath);
    if (!entity) {
      throw errorToThrow
        ? new errorToThrow(...errorArgs)
        : new EntityNotFound(this.entity, itemPath);
    }
    return entity;
  }

  async addOne({ itemPath, type = ItemLoginSchemaType.Username }: CreateItemLoginSchemaBody) {
    const existingItemLoginSchema = await this.getOneByItemPath(itemPath);
    // if item login schema is inherited
    if (existingItemLoginSchema && existingItemLoginSchema?.item.path !== itemPath) {
      throw new CannotNestItemLoginSchema(itemPath);
    }

    return await super.insert({ item: { id: getChildFromPath(itemPath), path: itemPath }, type });
  }

  async deleteOneByItemId(itemId: Item['id']) {
    this.throwsIfParamIsInvalid('itemId', itemId);

    const entity = await this.getOneByItemId(itemId);

    if (!entity) {
      throw new EntryNotFoundBeforeDeleteException(this.entity);
    }

    try {
      await this.repository.delete(entity.id);
      return entity;
    } catch (e) {
      assertIsError(e);
      throw new DeleteException(e.message);
    }
  }
}
