import { eq } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { UnionOfConst } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import { isAncestorOrSelf } from '../../drizzle/operations';
import { itemLoginSchemas } from '../../drizzle/schema';
import { ItemLoginSchemaRaw } from '../../drizzle/types';
import { throwsIfParamIsInvalid } from '../../repositories/utils';
import { CannotNestItemLoginSchema } from './errors';

export const ItemLoginSchemaType = {
  Username: 'username',
  UsernameAndPassword: 'username+password',
  Anonymous: 'anonymous',
  AnonymousAndPassword: 'anonymous+password',
} as const;
export type ItemSchemaTypeOptions = UnionOfConst<typeof ItemLoginSchemaType>;

export const ItemLoginSchemaStatus = {
  Active: 'active', // Guests can register and log in
  Disabled: 'disabled', // Guests can't register or log in
  Freeze: 'freeze',
} as const;
export type ItemLoginSchemaStatusOptions = UnionOfConst<
  typeof ItemLoginSchemaStatus
>;

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
  ): Promise<ItemLoginSchemaRaw | undefined> {
    throwsIfParamIsInvalid('item', itemId);

    return await db.query.itemLoginSchemas.findFirst({
      where: eq(itemLoginSchemas.itemPath, itemId),
    });
  }

  async getOneByItemPath(
    db: DBConnection,
    itemPath: ItemPath,
  ): Promise<ItemLoginSchemaRaw | undefined> {
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
      existingItemLoginSchema?.itemPath !== itemPath
    ) {
      throw new CannotNestItemLoginSchema(itemPath);
    }

    return await db.insert(itemLoginSchemas).values({ itemPath, type });
  }

  async deleteOneByItemId(db: DBConnection, itemId: string) {
    throwsIfParamIsInvalid('itemId', itemId);

    const entity = await this.getOneByItemId(db, itemId);

    if (!entity) {
      throw new Error('could not find entity before deletion');
    }

    return await db
      .delete(itemLoginSchemas)
      .where(eq(itemLoginSchemas.id, entity.id))
      .returning();
  }
}
