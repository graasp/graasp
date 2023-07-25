import { PermissionLevel } from '@graasp/sdk';

import { AppDataSource } from '../../../../../plugins/datasource';
import { Actor } from '../../../../member/entities/member';
import { mapById } from '../../../../utils';
import { Item } from '../../../entities/Item';
import { ItemPublished } from '../entities/itemPublished';
import { ItemPublishedNotFound } from '../errors';

export const ItemPublishedRepository = AppDataSource.getRepository(ItemPublished).extend({
  async getForItem(item: Item) {
    // this returns the root published item when querying a child item
    const entry = await this.createQueryBuilder('pi')
      .innerJoinAndSelect('pi.item', 'item', 'pi.item @> :itemPath', { itemPath: item.path })
      .innerJoinAndSelect('pi.creator', 'member')
      .getOne();
    if (!entry) {
      throw new ItemPublishedNotFound(item.id);
    }

    return entry;
  },
  async getForItems(items: Item[]) {
    const paths = items.map((i) => i.path);
    const ids = items.map((i) => i.id);
    const entries = await this.createQueryBuilder('pi')
      .innerJoinAndSelect('pi.item', 'item', 'pi.item @> ARRAY[:...paths]::ltree[]', {
        paths,
      })
      .innerJoinAndSelect('pi.creator', 'member')
      .getMany();

    return mapById({
      keys: ids,
      findElement: (id) =>
        entries.find((e) => items.find((i) => i.id === id)?.path.startsWith(e.item.path)),
      buildError: (id) => new ItemPublishedNotFound(id),
    });
  },

  // return public item entry? contains when it was published
  async getAllPublishedItems(): Promise<Item[]> {
    // we get the nested relation of item.creator because we only return the item and without this the creator is not returned
    const publishedRows = await this.createQueryBuilder()
      .select(['item'])
      .from(Item, 'item')
      .leftJoinAndSelect('item.creator', 'creator')
      .innerJoin('item_published', 'ip', 'ip.item_path = item.path')
      .getMany();
    return publishedRows;
  },

  // return public item entry? contains when it was published
  async getItemsForMember(memberId: string) {
    // get for membership write and admin -> createquerybuilder
    return this.createQueryBuilder()
      .select(['item'])
      .from(Item, 'item')
      .innerJoin('item_published', 'pi', 'pi.item_path = item.path')
      .innerJoin('item_membership', 'im', 'im.item_path @> item.path')
      .where('im.member_id = :memberId', { memberId })
      .andWhere('im.permission IN (:...permissions)', {
        permissions: [PermissionLevel.Admin, PermissionLevel.Write],
      })
      .getMany();
  },

  async post(creator: Actor, item: Item) {
    const p = this.create({ item, creator });
    await this.insert(p);
    return p;
  },

  async deleteForItem(item: Item) {
    const entry = await this.getForItem(item);

    await this.delete(entry.id);
    return entry;
  },

  async getRecentItems(limit: number = 10): Promise<Item[]> {
    const publishedInfos = await this.createQueryBuilder('item_published')
      .innerJoinAndSelect('item_published.item', 'item')
      .innerJoinAndSelect('item.creator', 'member')
      .orderBy('item.createdAt', 'DESC')
      .take(limit)
      .getMany();

    return publishedInfos.map(({ item }) => item);
  },

  // QUESTION: where should we define this? mix between publish and category
  /**
   * get interesection of category ids and published
   *
   * ['A1,A2'] -> the item should have either A1 or A2 as category
   * ['B1', 'B2'] -> the item should have both categories
   * Return all if no ids is defined
   * @param ids category ids - in the form of ['A1,A2', 'B1', 'C1,C2,C3']
   * @returns object { id } of items with given categories
   */
  async getByCategories(categoryIds: string[]): Promise<Item[]> {
    const query = this.createQueryBuilder()
      .select(['item'])
      .from(Item, 'item')
      .innerJoin('item_published', 'ip', 'ip.item_path = item.path')
      .innerJoin('item_category', 'ic', 'ic.item_path @> item.path')
      .groupBy('item.id');

    categoryIds.forEach((idString, idx) => {
      // split categories
      const categoryIdList = idString.split(',');
      // dynamic key to avoid overlapping
      const key = `id${idx}`;
      if (idx === 0) {
        // item should at least have one category with the category group
        query.having(`array_agg(DISTINCT ic.category_id) && ARRAY[:...${key}]::uuid[]`, {
          [key]: categoryIdList,
        });
      } else {
        query.andHaving(`array_agg(DISTINCT ic.category_id) && ARRAY[:...${key}]::uuid[]`, {
          [key]: categoryIdList,
        });
      }
    });
    return query.getMany();
  },

  // return public items sorted by most liked
  // bug: does not take into account child items
  async getLikedItems(limit: number = 10): Promise<Item[]> {
    const itemPublished = await this.createQueryBuilder('item_published')
      .innerJoinAndSelect('item_published.item', 'item')
      .innerJoinAndSelect('item.creator', 'member')
      .innerJoin('item_like', 'il', 'il.item_id = item.id')
      .groupBy(['item.id', 'member.id', 'item_published.id'])
      .orderBy('COUNT(il.id)', 'DESC')
      .limit(limit)
      .getMany();

    return itemPublished.map(({ item }) => item);
  },
});
