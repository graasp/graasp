import { In } from 'typeorm';

import { PermissionLevel } from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource';
import { Member } from '../../../member/entities/member';
import { Item } from '../../entities/Item';
import { PackedRecycledItemData, RecycledItemData } from './RecycledItemData';
import { CannotRestoreNonDeletedItem } from './errors';

export const RecycledItemDataRepository = AppDataSource.getRepository(RecycledItemData).extend({
  async getOwnRecycledItemDatas(member: Member): Promise<PackedRecycledItemData[]> {
    // get only with admin membership
    const recycledItemEntries = await this.createQueryBuilder('recycledItem')
      .withDeleted()
      .leftJoinAndSelect('recycledItem.creator', 'member')
      .leftJoinAndSelect('recycledItem.item', 'item')
      .leftJoinAndSelect('item.creator', 'itemMember')
      .innerJoin(
        'item_membership',
        'im',
        `im.item_path @> item.path 
        AND im.permission = :permission 
        AND im.member_id = :memberId`,
        { permission: PermissionLevel.Admin, memberId: member.id },
      )
      .getMany();

    return recycledItemEntries.map((r) => ({
      ...r,
      item: { ...r.item, permission: PermissionLevel.Admin },
    }));
  },

  // warning: this call insert in the table
  // but does not soft delete the item
  // should we move to core item?
  async recycleOne(item: Item, creator: Member) {
    const recycled = this.create({ item, creator });
    await this.insert(recycled);
    return recycled;
  },

  // warning: this call insert in the table
  // but does not soft delete the item
  // should we move to core item?
  async recycleMany(items: Item[], creator: Member) {
    const recycled = items.map((item) => this.create({ item, creator }));
    this.insert(recycled);
    return recycled;
  },

  // warning: this call insert in the table
  // but does not soft delete the item
  // should we move to core item?
  async restoreOne(item: Item) {
    // optimize ? delete by item ?
    const entry = await this.findOne({
      where: { item: { path: item.path } },
      relations: { item: true },
    });

    if (!entry) {
      throw new CannotRestoreNonDeletedItem(item.id);
    }

    await this.delete(entry.id);
    return entry;
  },

  // warning: this call insert in the table
  // but does not soft delete the item
  // should we move to core item?
  async restoreMany(items: Item[]) {
    // optimize ? delete by item ?
    const entries = await this.findBy({ item: { path: In(items.map(({ path }) => path)) } });
    await this.delete(entries.map(({ id }) => id));
  },
});
