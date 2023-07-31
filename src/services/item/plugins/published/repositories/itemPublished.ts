import { AppDataSource } from '../../../../../plugins/datasource';
import { Actor } from '../../../../member/entities/member';
import { mapById, printFilledSQL } from '../../../../utils';
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
