import { and, eq, getTableColumns } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { UnionOfConst } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import { isAncestorOrSelf } from '../../drizzle/operations';
import { itemLoginSchemas, items } from '../../drizzle/schema';
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
  async getOneByItemId(db: DBConnection, itemId: ItemId): Promise<ItemLoginSchemaRaw | undefined> {
    throwsIfParamIsInvalid('item', itemId);
    // TODO: check this works
    const results = await db
      .select(getTableColumns(itemLoginSchemas))
      .from(itemLoginSchemas)
      .innerJoin(
        items,
        and(isAncestorOrSelf(itemLoginSchemas.itemPath, items.path), eq(items.id, itemId)),
      );
    const firstResult = results[0];
    return firstResult;
  }

  async getOneByItemPath(
    db: DBConnection,
    itemPath: ItemPath,
  ): Promise<ItemLoginSchemaWithItem | undefined> {
    throwsIfParamIsInvalid('itemPath', itemPath);

    return await db.query.itemLoginSchemas.findFirst({
      where: isAncestorOrSelf(itemLoginSchemas.itemPath, itemPath),
      with: { item: true },
    });
  }

  async addOne(
    db: DBConnection,
    { itemPath, type = ItemLoginSchemaType.Username }: CreateItemLoginSchemaBody,
  ) {
    const existingItemLoginSchema = await this.getOneByItemPath(db, itemPath);
    // if item login schema is inherited
    if (existingItemLoginSchema && existingItemLoginSchema?.itemPath !== itemPath) {
      throw new CannotNestItemLoginSchema(itemPath);
    }

    return await db.insert(itemLoginSchemas).values({ itemPath, type });
  }

  async put(
    db: DBConnection,
    itemPath: ItemLoginSchemaRaw['itemPath'],
    { type, status },
  ): Promise<void> {
    const itemLoginSchema = await this.getOneByItemPath(db, itemPath);
    if (itemLoginSchema) {
      await db
        .update(itemLoginSchemas)
        .set({ type, status })
        .where(eq(itemLoginSchemas.id, itemLoginSchema.id));
    } else {
      await db.insert(itemLoginSchemas).values({ itemPath, type, status });
      // QUESTION: this does not look efficient if we need to check on path
      // .onConflictDoUpdate({
      //   target: itemLoginSchemas.itemPath,
      //   targetWhere: isAncestorOrSelf(itemLoginSchemas.itemPath, itemPath),
      //   set: {
      //     type,
      //     status,
      //   },
      // });
    }
  }

  async deleteOneByItemId(db: DBConnection, itemId: string) {
    throwsIfParamIsInvalid('itemId', itemId);

    const entity = await this.getOneByItemId(db, itemId);

    if (!entity) {
      throw new Error('could not find entity before deletion');
    }

    return (
      await db.delete(itemLoginSchemas).where(eq(itemLoginSchemas.id, entity.id)).returning()
    )[0];
  }
}
