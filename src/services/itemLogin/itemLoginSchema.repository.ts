import { and, eq, getTableColumns } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { UnionOfConst } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import { isAncestorOrSelf } from '../../drizzle/operations';
import { itemLoginSchemasTable, items } from '../../drizzle/schema';
import { ItemLoginSchemaRaw, ItemLoginSchemaWithItem } from '../../drizzle/types';
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
export type ItemLoginSchemaStatusOptions = UnionOfConst<typeof ItemLoginSchemaStatus>;

type ItemPath = string;
type ItemId = string;
type CreateItemLoginSchemaBody = {
  itemPath: ItemPath;
  type?: ItemSchemaTypeOptions;
};

@singleton()
export class ItemLoginSchemaRepository {
  async getOneByItemId(
    dbConnection: DBConnection,
    itemId: ItemId,
  ): Promise<ItemLoginSchemaRaw | undefined> {
    throwsIfParamIsInvalid('item', itemId);

    const results = await dbConnection
      .select(getTableColumns(itemLoginSchemasTable))
      .from(itemLoginSchemasTable)
      .innerJoin(
        items,
        and(isAncestorOrSelf(itemLoginSchemasTable.itemPath, items.path), eq(items.id, itemId)),
      );
    const firstResult = results[0];
    return firstResult;
  }

  async getOneByItemPath(
    dbConnection: DBConnection,
    itemPath: ItemPath,
  ): Promise<ItemLoginSchemaWithItem | undefined> {
    throwsIfParamIsInvalid('itemPath', itemPath);

    return await dbConnection.query.itemLoginSchemasTable.findFirst({
      where: isAncestorOrSelf(itemLoginSchemasTable.itemPath, itemPath),
      with: { item: true },
    });
  }

  async addOne(
    dbConnection: DBConnection,
    { itemPath, type = ItemLoginSchemaType.Username }: CreateItemLoginSchemaBody,
  ) {
    const existingItemLoginSchema = await this.getOneByItemPath(dbConnection, itemPath);
    // if item login schema is inherited
    if (existingItemLoginSchema && existingItemLoginSchema?.itemPath !== itemPath) {
      throw new CannotNestItemLoginSchema(itemPath);
    }

    return await dbConnection.insert(itemLoginSchemasTable).values({ itemPath, type });
  }

  async put(
    dbConnection: DBConnection,
    itemPath: ItemLoginSchemaRaw['itemPath'],
    { type, status },
  ): Promise<void> {
    const itemLoginSchema = await this.getOneByItemPath(dbConnection, itemPath);
    if (itemLoginSchema) {
      // cannot update item login schema if it is requested from the child
      if (itemLoginSchema.itemPath !== itemPath) {
        throw new CannotNestItemLoginSchema(itemLoginSchema.itemPath);
      }

      await dbConnection
        .update(itemLoginSchemasTable)
        .set({ type, status })
        .where(eq(itemLoginSchemasTable.id, itemLoginSchema.id));
    } else {
      await dbConnection.insert(itemLoginSchemasTable).values({ itemPath, type, status });
    }
  }

  async deleteOneByItemId(dbConnection: DBConnection, itemId: string) {
    throwsIfParamIsInvalid('itemId', itemId);

    const entity = await this.getOneByItemId(dbConnection, itemId);

    if (!entity) {
      throw new Error('could not find entity before deletion');
    }

    await dbConnection.delete(itemLoginSchemasTable).where(eq(itemLoginSchemasTable.id, entity.id));
  }
}
