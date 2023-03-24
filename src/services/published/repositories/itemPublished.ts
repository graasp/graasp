import { PermissionLevel } from '@graasp/sdk';

import { AppDataSource } from '../../../plugins/datasource';
import { Item } from '../../item/entities/Item';
import { ItemPublished } from '../entities/itemPublished';
import { ItemPublishedNotFound } from '../errors';

export const ItemPublishedRepository = AppDataSource.getRepository(ItemPublished).extend({
  async getForItem(item: Item, { shouldExist } = { shouldExist: false }) {
    const entry = await this.findOne({
      where: { item: { id: item.id } },
      relations: { item: true, creator: true },
    });
    if (shouldExist && !entry) {
      throw new ItemPublishedNotFound(item);
    }

    return entry;
  },

  // return public item entry? contains when it was published
  async getAllItems() {
    const publishedRows = await this.find({ relations: { item: true } });
    return publishedRows.map(({ item }) => item);
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

  async post(creator, item: Item) {
    const p = this.create({ item, creator });
    await this.insert(p);
    return p;
  },

  async deleteForItem(item: Item) {
    const entry = await this.getForItem(item, { shouldExist: true });

    await this.delete(entry.id);
    return entry;
  },

  // async arePublished(items: Item[]) {
  //   const query = this.createQueryBuilder('publishedItem')
  //     .leftJoinAndSelect('publishedItem.item', 'item')
  //     .where('item.path @> ARRAY[:...paths]::ltree[]', { paths: items.map(({ path }) => path) });

  //   const arePublished = await query.getMany();

  //   return mapById({
  //     keys: items.map(({ path }) => path),
  //     findElement: (path) => Boolean(arePublished.find(({ item }) => path.includes(item.path))),
  //     buildError: (id) => new Error(`item with ${id} is not published`), // TODO
  //   });
  // },

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
  async getByCategories(categoryIds: string[]) {
    const query = this.createQueryBuilder()
      .select(['item'])
      .from(Item, 'item')
      .innerJoin('published_item', 'pi', 'pi.item_path @> item.path')
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
});
