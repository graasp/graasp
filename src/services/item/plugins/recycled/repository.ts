import { EntityManager, In } from 'typeorm';

import { Paginated, Pagination, PermissionLevel } from '@graasp/sdk';

import { MutableRepository } from '../../../../repositories/MutableRepository';
import { DEFAULT_PRIMARY_KEY } from '../../../../repositories/const';
import { Account } from '../../../account/entities/account';
import { ItemMembership } from '../../../itemMembership/entities/ItemMembership';
import { Member } from '../../../member/entities/member';
import { ITEMS_PAGE_SIZE_MAX } from '../../constants';
import { Item } from '../../entities/Item';
import { RecycledItemData } from './RecycledItemData';

type CreateRecycledItemDataBody = { itemPath: string; creatorId: string };

export class RecycledItemDataRepository extends MutableRepository<RecycledItemData, never> {
  constructor(manager?: EntityManager) {
    super(DEFAULT_PRIMARY_KEY, RecycledItemData, manager);
  }

  // warning: this call insert in the table
  // but does not soft delete the item
  // should we move to core item?
  async addOne({ itemPath, creatorId }: CreateRecycledItemDataBody) {
    return await super.insert({ item: { path: itemPath }, creator: { id: creatorId } });
  }

  // warning: this call insert in the table
  // but does not soft delete the item
  // should we move to core item?
  async addMany(items: Item[], creator: Member) {
    const recycled = items.map((item) => this.repository.create({ item, creator }));
    await this.repository.insert(recycled);
    return recycled;
  }

  async getOwnRecycledItems(account: Account, pagination: Pagination): Promise<Paginated<Item>> {
    const { page, pageSize } = pagination;
    const limit = Math.min(pageSize, ITEMS_PAGE_SIZE_MAX);
    const skip = (page - 1) * limit;

    const query = this.manager
      // start with smaller table that can have the most contraints: membership with admin and accountId
      .getRepository(ItemMembership)
      .createQueryBuilder('im')
      // we want to join on recycled item
      .withDeleted()
      // get top most recycled item
      .innerJoin(RecycledItemData, 'rid', 'im.item_path  @>  rid.item_path')
      .innerJoinAndSelect(
        'rid.item',
        'item',
        // reduce size by getting only recycled items
        // `item.path <@ im.item_path and item.deleted_at is not null`,
      )

      // return item's creator
      .leftJoinAndSelect('item.creator', 'member')
      // item membership constraints
      .where(`im.account_id = :accountId`, {
        accountId: account.id,
      })
      .andWhere(` im.permission = :permission`, {
        permission: PermissionLevel.Admin,
      })
      // show most recently deleted items first
      .orderBy('item.deleted_at', 'DESC')
      .offset(skip)
      .limit(limit);
    const countQuery = this.manager
      // start with smaller table that can have the most contraints: membership with admin and accountId
      .getRepository(ItemMembership)
      .createQueryBuilder('im')
      // we want to join on recycled item
      .withDeleted()
      // get top most recycled item
      .innerJoin(RecycledItemData, 'rid', 'im.item_path  @>  rid.item_path')
      .where(`im.account_id = :accountId`, {
        accountId: account.id,
      })
      .andWhere(` im.permission = :permission`, {
        permission: PermissionLevel.Admin,
      });

    const data = await query.getRawMany();

    const totalCount = await countQuery.getCount();

    // remap raw values
    const allResults = data.map(
      (i) =>
        ({
          id: i.item_id,
          name: i.item_name,
          description: i.item_description,
          type: i.item_type,
          createdAt: new Date(i.item_created_at),
          updatedAt: new Date(i.item_updated_at),
          extra: JSON.parse(i.item_extra ?? {}),
          settings: JSON.parse(i.item_settings ?? {}),
          path: i.item_path,
          lang: i.item_lang,
          creator: i.item_creator_id
            ? {
                id: i.item_creator_id,
                name: i.member_name,
                type: i.member_type,
              }
            : null,
        }) as Item,
    );

    return {
      // remove duplicate
      data: [...new Map(allResults.map((item) => [item.id, item])).values()],
      totalCount,
      pagination,
    };
  }

  // warning: this call removes from the table
  // but does not soft delete the item
  // should we move to core item?
  async deleteManyByItemPath(itemsPath: Item['path'][]) {
    this.throwsIfParamIsInvalid('itemsPath', itemsPath);
    // optimize ? delete by item ?
    const entries = await this.repository.findBy({
      item: { path: In(itemsPath) },
    });
    await this.delete(entries.map(({ id }) => id));
  }
}
