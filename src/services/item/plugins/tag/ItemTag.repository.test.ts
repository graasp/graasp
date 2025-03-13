import { and, eq } from 'drizzle-orm/sql';
import { v4 } from 'uuid';

import { FolderItemFactory, TagCategory } from '@graasp/sdk';

import { client, db } from '../../../../drizzle/db';
import { itemTags, itemsRaw } from '../../../../drizzle/schema';
import { ItemInsertDTO } from '../../../../drizzle/types';
import { IllegalArgumentException } from '../../../../repositories/errors';
import { assertIsDefined } from '../../../../utils/assertions';
import { saveTag } from '../../../tag/fixtures/utils';
import { ItemTagRepository } from './ItemTag.repository';
import { TAG_COUNT_MAX_RESULTS } from './constants';
import { ItemTagAlreadyExists } from './errors';

const repository = new ItemTagRepository();

async function saveItem(item: ItemInsertDTO) {
  const res = await db.insert(itemsRaw).values(item).returning();
  const newItem = res[0];
  assertIsDefined(newItem);
  return newItem;
}

async function saveItemTag(args: { itemId: string; tagId: string }) {
  await db.insert(itemTags).values(args);
}

describe('ItemTag Repository', () => {
  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  describe('getCountBy', () => {
    it('throw for empty search', async () => {
      await expect(() =>
        repository.getCountBy(db, {
          search: '',
          category: TagCategory.Discipline,
        }),
      ).rejects.toBeInstanceOf(IllegalArgumentException);
    });
    it('return empty count for empty set', async () => {
      expect(
        await repository.getCountBy(db, {
          search: 'search',
          category: TagCategory.Discipline,
        }),
      ).toHaveLength(0);
    });
    it('get count for tags given search and category', async () => {
      const category = TagCategory.Discipline;
      const tag = await saveTag({ category });
      const item = await saveItem(FolderItemFactory({ creator: null }));
      await saveItemTag({ itemId: item.id, tagId: tag.id });
      const tag1 = await saveTag({ name: tag.name + ' second', category });
      const item1 = await saveItem(FolderItemFactory({ creator: null }));
      await saveItemTag({ itemId: item1.id, tagId: tag1.id });
      await saveItemTag({ itemId: item.id, tagId: tag1.id });

      // noise
      const tag2 = await saveTag({ name: tag.name + ' second', category: TagCategory.Level });
      await saveItemTag({ itemId: item1.id, tagId: tag2.id });

      const tags = await repository.getCountBy(db, {
        search: tag.name,
        category,
      });
      expect(tags).toHaveLength(2);
      expect(tags.find(({ name }) => tag.name === name)!.count).toEqual(1);
      expect(tags.find(({ name }) => tag1.name === name)!.count).toEqual(2);
    });

    // FIX: we do not allow searching witout category
    it.skip('get count for tags given search without category', async () => {
      // const tag = await saveTag();
      // const item = await saveItem(FolderItemFactory({ creator: null }));
      // await saveItemTag({ itemId: item.id, tagId: tag.id });
      // const tag1 = await saveTag({ name: tag.name + ' second' });
      // const item1 = await saveItem(FolderItemFactory({ creator: null }));
      // await saveItemTag({ itemId: item1.id, tagId: tag1.id });
      // await saveItemTag({ itemId: item.id, tagId: tag1.id });
      // const tags = await repository.getCountBy(db, {
      //   search: tag.name,
      // });
      // expect(tags).toHaveLength(2);
      // expect(tags.find(({ name }) => tag.name === name)!.count).toEqual(1);
      // expect(tags.find(({ name }) => tag1.name === name)!.count).toEqual(2);
    });

    it(`get max ${TAG_COUNT_MAX_RESULTS} counts for tags`, async () => {
      const category = TagCategory.Discipline;
      // create more tags and association than limit
      const promises = Array.from({ length: TAG_COUNT_MAX_RESULTS + 13 }, async (_, idx) => {
        const tag = await saveTag({ name: 'tag' + idx, category });
        for (let i = 0; i < idx; i++) {
          const item = await saveItem(FolderItemFactory({ creator: null }));
          await saveItemTag({ itemId: item.id, tagId: tag.id });
        }
        return tag;
      });
      const tags = await Promise.all(promises);

      const result = await repository.getCountBy(db, {
        search: 'tag',
        category,
      });
      // should have only max number of counts
      expect(result).toHaveLength(TAG_COUNT_MAX_RESULTS);

      // last tags in the array are the most used
      for (const t of tags.slice(-TAG_COUNT_MAX_RESULTS)) {
        const res = result.find(({ name }) => t.name === name);
        expect(res).toBeDefined();
        expect(res?.count).toBeGreaterThan(1);
      }
    });
  });

  describe('getForItem', () => {
    it('throw for invalid item id', async () => {
      await expect(() => repository.getByItemId(db, undefined!)).rejects.toBeInstanceOf(
        IllegalArgumentException,
      );
    });
    it('return empty tags for non-existing item', async () => {
      expect(await repository.getByItemId(db, v4())).toHaveLength(0);
    });
    it('get empty tags for item', async () => {
      const item = await saveItem(FolderItemFactory({ creator: null }));

      const tags = await repository.getByItemId(db, item.id);
      expect(tags).toHaveLength(0);
    });

    it('get tags for item', async () => {
      // save item with tags
      const item = await saveItem(FolderItemFactory({ creator: null }));
      const tag1 = await saveTag();
      const tag2 = await saveTag();
      await saveItemTag({ itemId: item.id, tagId: tag1.id });
      await saveItemTag({ itemId: item.id, tagId: tag2.id });

      // noise
      const anotherTag = await saveTag();
      const anotherItem = await saveItem(FolderItemFactory({ creator: null }));
      await saveItemTag({ itemId: anotherItem.id, tagId: anotherTag.id });

      const tags = await repository.getByItemId(db, item.id);
      expect(tags).toEqual(expect.arrayContaining([tag1, tag2]));
    });
  });

  describe('createForItem', () => {
    it('throw for invalid item id', async () => {
      const tag = await saveTag();
      await expect(() => repository.create(db, undefined!, tag.id)).rejects.toThrow();
    });
    it('throw for invalid tag id', async () => {
      const item = await saveItem(FolderItemFactory({ creator: null }));

      await expect(() => repository.create(db, item.id, undefined!)).rejects.toThrow();
    });
    it('throw for non-existing item', async () => {
      const tag = await saveTag();
      await expect(() => repository.create(db, v4(), tag.id)).rejects.toThrow();
    });
    it('throw for non-existing tag', async () => {
      const item = await saveItem(FolderItemFactory({ creator: null }));

      await expect(() => repository.create(db, item.id, v4())).rejects.toThrow();
    });
    it('create tag for item', async () => {
      const tag = await saveTag();
      const item = await saveItem(FolderItemFactory({ creator: null }));

      await repository.create(db, item.id, tag.id);

      const result = await db.query.itemTags.findFirst({
        where: and(eq(itemTags.itemId, item.id), eq(itemTags.tagId, tag.id)),
      });
      expect(result).toBeDefined();
    });
    it('throw if tag already exists for item', async () => {
      const tag = await saveTag();
      const item = await saveItem(FolderItemFactory({ creator: null }));
      await saveItemTag({ tagId: tag.id, itemId: item.id });

      await expect(async () => await repository.create(db, item.id, tag.id)).rejects.toThrow(
        new ItemTagAlreadyExists({ itemId: item.id, tagId: tag.id }),
      );
    });
  });
  describe('delete', () => {
    it('throw for invalid item id', async () => {
      const tag = await saveTag();
      await expect(() => repository.delete(db, undefined!, tag.id)).rejects.toThrow();
    });
    it('throw for invalid tag id', async () => {
      const item = await saveItem(FolderItemFactory({ creator: null }));

      await expect(() => repository.delete(db, item.id, undefined!)).rejects.toThrow();
    });
    it('does not throw for non-existing item', async () => {
      const tag = await saveTag();
      expect(await repository.delete(db, v4(), tag.id)).toBeUndefined();
    });
    it('does not throw for non-existing tag', async () => {
      const item = await saveItem(FolderItemFactory({ creator: null }));

      expect(await repository.delete(db, item.id, v4())).toBeUndefined();
    });
    it('does not throw if tag is not associated with item', async () => {
      const tag = await saveTag();
      const item = await saveItem(FolderItemFactory({ creator: null }));

      expect(await repository.delete(db, item.id, tag.id)).toBeUndefined();
    });
    it('delete tag for item', async () => {
      const tag = await saveTag();
      const item = await saveItem(FolderItemFactory({ creator: null }));
      await saveItemTag({ tagId: tag.id, itemId: item.id });

      // noise
      const tag1 = await saveTag();
      await saveItemTag({ tagId: tag1.id, itemId: item.id });
      const preResult = await db.query.itemTags.findFirst({
        where: and(eq(itemTags.itemId, item.id), eq(itemTags.tagId, tag.id)),
      });
      expect(preResult).toBeDefined();

      await repository.delete(db, item.id, tag.id);

      const result = await db.query.itemTags.findFirst({
        where: and(eq(itemTags.itemId, item.id), eq(itemTags.tagId, tag.id)),
      });
      expect(result).toBeUndefined();

      // noise still exists
      const result1 = await db.query.itemTags.findFirst({
        where: and(eq(itemTags.itemId, item.id), eq(itemTags.tagId, tag1.id)),
        with: { tag: true },
      });
      expect(result1).toBeDefined();
      expect(result1?.tag.id).toEqual(tag1.id);
    });
  });
});
