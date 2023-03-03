import { ItemLoginSchemaType } from '@graasp/sdk';

import { AppDataSource } from '../../../plugins/datasource';
import { Item } from '../../item/entities/Item';
import { ItemLoginSchema } from '../entities/itemLoginSchema';
import { loginSchemaRequiresPassword } from '../util/aux';
import {
  ItemLoginSchemaNotFound,
  MissingCredentialsForLoginSchema,
  MissingItemLoginTag,
  UnnecessaryCredentialsForLoginSchema,
} from '../util/graasp-item-login-error';

export const ItemLoginSchemaRepository = AppDataSource.getRepository(ItemLoginSchema).extend({
  async getForItemPath(
    itemPath: string,
    { shouldExist = false }: { shouldExist?: boolean } = {},
  ): Promise<ItemLoginSchema | null> {
    const result = await this.createQueryBuilder('login')
      .leftJoinAndSelect('login.item', 'item')
      .where('item.path <@ :path', { path: itemPath })
      .getOne();

    if (shouldExist) {
      if (!result) {
        throw new Error('no item login');
      }
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

  async put(item: Item, type: ItemLoginSchemaType = ItemLoginSchemaType.USERNAME) {
    return this.save({ item, type });
  },

  async validateItemLogin(itemId: string, passwordProvided: string): Promise<void> {
    // check item for the necessary tag
    const itemDetails = await this.get(itemId);
    if (!itemDetails) throw new MissingItemLoginTag();

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
export default ItemLoginSchemaRepository;
