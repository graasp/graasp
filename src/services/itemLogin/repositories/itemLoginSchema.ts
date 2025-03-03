import { eq } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { UnionOfConst } from '@graasp/sdk';

import { DBConnection } from '../../../drizzle/db';
import { isAncestorOrSelf } from '../../../drizzle/operations';
import { itemLoginSchemas } from '../../../drizzle/schema';
import { DeleteException } from '../../../repositories/errors';
import { throwsIfParamIsInvalid } from '../../../repositories/utils';
import { assertIsError } from '../../../utils/assertions';
import { CannotNestItemLoginSchema } from '../errors';

export const ItemLoginSchemaType = {
  Username: 'username',
  UsernameAndPassword: 'username+password',
  Anonymous: 'anonymous',
  AnonymousAndPassword: 'anonymous+password',
} as const;
export type ItemSchemaTypeOptions = UnionOfConst<typeof ItemLoginSchemaType>;

type ItemPath = string;
type ItemId = string;
type CreateItemLoginSchemaBody = {
  itemPath: ItemPath;
  type?: ItemSchemaTypeOptions;
};

@singleton()
export class ItemLoginSchemaRepository {
  async getOneByItemId(
    db: DBConnection,
    itemId: ItemId,
  ): Promise<ItemLoginSchema | null> {
    throwsIfParamIsInvalid('item', itemId);

    return await db.query.itemLoginSchemas.findFirst({
      where: eq(itemLoginSchemas.itemPath, itemId),
    });
  }

  async getOneByItemPath(
    db: DBConnection,
    itemPath: ItemPath,
  ): Promise<ItemLoginSchema | null> {
    throwsIfParamIsInvalid('itemPath', itemPath);

    return await db.query.itemLoginSchemas.findFirst({
      where: isAncestorOrSelf(itemLoginSchemas.itemPath, itemPath),
      with: { item: true },
    });
  }

  async addOne(
    db: DBConnection,
    {
      itemPath,
      type = ItemLoginSchemaType.Username,
    }: CreateItemLoginSchemaBody,
  ) {
    const existingItemLoginSchema = await this.getOneByItemPath(db, itemPath);
    // if item login schema is inherited
    if (
      existingItemLoginSchema &&
      existingItemLoginSchema?.item.path !== itemPath
    ) {
      throw new CannotNestItemLoginSchema(itemPath);
    }

    return await db.insert(itemLoginSchemas).values({ itemPath, type });
  }

  async deleteOneByItemId(db: DBConnection, itemId: Item['id']) {
    throwsIfParamIsInvalid('itemId', itemId);

    const entity = await this.getOneByItemId(db, itemId);

    if (!entity) {
      throw new EntryNotFoundBeforeDeleteException(this.entity);
    }

    try {
      await db
        .delete(itemLoginSchemas)
        .where(eq(itemLoginSchemas.id, entity.id));
      return entity;
    } catch (e) {
      assertIsError(e);
      throw new DeleteException(e.message);
    }
  }
}
