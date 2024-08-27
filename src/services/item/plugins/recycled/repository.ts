import { EntityManager, In } from 'typeorm';

import { PermissionLevel } from '@graasp/sdk';

import { MutableRepository } from '../../../../repositories/MutableRepository';
import { DEFAULT_PRIMARY_KEY } from '../../../../repositories/const';
import { Member } from '../../../member/entities/member';
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

  async getManyByMember(member: Member): Promise<RecycledItemData[]> {
    // get only with admin membership
    return await this.repository
      .createQueryBuilder('recycledItem')
      .withDeleted()
      .leftJoinAndSelect('recycledItem.creator', 'member')
      .leftJoinAndSelect('recycledItem.item', 'item')
      .leftJoinAndSelect('item.creator', 'itemMember')
      .innerJoin(
        'item_membership',
        'im',
        `im.item_path @> item.path 
        AND im.permission = :permission 
        AND im.account_id = :accountId`,
        { permission: PermissionLevel.Admin, accountId: member.id },
      )
      .getMany();
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
