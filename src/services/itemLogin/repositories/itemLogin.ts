import { AppDataSource } from '../../../plugins/datasource';
import { Item } from '../../item/entities/Item';
import { ItemLogin } from '../entities/itemLogin';
import { InvalidCredentials } from '../errors';
import { encryptPassword, loginSchemaRequiresPassword, validatePassword } from '../utils';

export const ItemLoginRepository = AppDataSource.getRepository(ItemLogin).extend({
  async getForItemAndMemberId(item: Item, memberId: string) {
    return this.createQueryBuilder('login')
      .leftJoinAndSelect('login.itemLoginSchema', 'iLS')
      .leftJoinAndSelect('iLS.item', 'item')
      .leftJoinAndSelect('login.member', 'member')
      .where('item.path <@ :path', { path: item.path })
      .andWhere('member.id = :id', { id: memberId })
      .getOne();
  },
  // TODO: use above? refactor?
  async getForItemAndUsername(item: Item, username: string) {
    // TODO: what if there's two bond members w/ the same username? options:
    // - fail login if there's already another user w/ the same username;
    // - keep a 'username' per space by adding a column to 'item_member_login'
    //
    // check if member w/ memberId is present
    return this.createQueryBuilder('login')
      .leftJoinAndSelect('login.itemLoginSchema', 'itemLoginSchema')
      .leftJoinAndSelect('itemLoginSchema.item', 'item')
      .leftJoinAndSelect('login.member', 'member')
      .where('item.path <@ :path', { path: item.path })
      .andWhere('member.name = :name', { name: username })
      .getOne();
  },

  async getItemMembers(path: string) {
    return this.createQueryBuilder('login')
      .leftJoinAndSelect('login.item', 'item')
      .leftJoinAndSelect('login.member', 'member')
      .where('item.path <@ :path', { path });
  },

  async post(data: Partial<ItemLogin>) {
    await this.insert(data);
  },

  async put(itemLogin: ItemLogin, password?: string) {
    // TODO: remove password? schema does not check if it does not have password?
    await this.update(itemLogin, { password });
  },

  async validateCredentials(password: string, itemLogin: ItemLogin): Promise<void> {
    const { password: itemLoginPassword, itemLoginSchema } = itemLogin;

    if (loginSchemaRequiresPassword(itemLoginSchema.type)) {
      if (itemLoginPassword) {
        const passwordOk = await validatePassword(password, itemLoginPassword);
        if (!passwordOk) throw new InvalidCredentials();
      } else {
        // schema was modified from passwordless to '* + password' - update member with password
        const passwordHash = await encryptPassword(password);

        await this.put(itemLogin, passwordHash);
      }
    }
  },
});
export default ItemLoginRepository;
