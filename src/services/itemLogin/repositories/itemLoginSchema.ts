import { ItemLoginSchemaType } from '@graasp/sdk';

import { AppDataSource } from '../../../plugins/datasource.js';
import { Item } from '../../item/entities/Item.js';
import { ItemLoginSchema } from '../entities/itemLoginSchema.js';
import {
  CannotNestItemLoginSchema,
  ItemLoginSchemaNotFound,
  MissingCredentialsForLoginSchema,
  MissingItemLoginTag,
  UnnecessaryCredentialsForLoginSchema,
} from '../errors.js';
import { loginSchemaRequiresPassword } from '../utils.js';

export const ItemLoginSchemaRepository = AppDataSource.getRepository(ItemLoginSchema).extend({
  async getForItemPath(
    itemPath: string,
    { shouldExist = false }: { shouldExist?: boolean } = {},
  ): Promise<ItemLoginSchema | null> {
    const result = await this.createQueryBuilder('login')
      .leftJoinAndSelect('login.item', 'item')
      .where('item.path @> :path', { path: itemPath })
      .getOne();

    if (shouldExist && !result) {
      throw new ItemLoginSchemaNotFound({ itemPath });
    }

    return result;
  },

  async deleteForItem(item: Item) {
    const deleteResult = await this.createQueryBuilder()
      .delete()
      .where('item.path = :itemPath', { itemPath: item.path })
      .returning('*')
      .execute();

    // TODO
    if (!deleteResult.raw.length) {
      throw new ItemLoginSchemaNotFound({ itemId: item.id });
    }

    return deleteResult.raw[0].id;
  },

  async put(item: Item, type: ItemLoginSchemaType = ItemLoginSchemaType.Username) {
    const existingItemLoginSchema = await this.getForItemPath(item.path);
    // if item login schema is inherited
    if (existingItemLoginSchema && existingItemLoginSchema?.item.path !== item.path) {
      throw new CannotNestItemLoginSchema(item.id);
    }

    const entry = this.create({ item, type });
    await this.upsert(entry, {
      conflictPaths: ['item'],
      skipUpdateIfNoValuesChanged: true, // supported by postgres, skips update if it would not change row values
    });
    return entry;
  },

  async validateItemLogin(itemId: string, passwordProvided: string): Promise<void> {
    // check item for the necessary tag
    const itemDetails = await this.get(itemId);
    if (!itemDetails) {
      throw new MissingItemLoginTag();
    }

    // TODO: remove? type cannot be empty
    // fail (unexpected) if there's no item-login specific "extras"
    const { type } = itemDetails;
    // if (!type) throw new MissingItemLoginSchema();

    // check for missing credentials agaisnt the login schema
    if (loginSchemaRequiresPassword(type) && !passwordProvided) {
      throw new MissingCredentialsForLoginSchema(type);
    } else if (!loginSchemaRequiresPassword(type) && passwordProvided) {
      throw new UnnecessaryCredentialsForLoginSchema(type);
    }
  },
});
