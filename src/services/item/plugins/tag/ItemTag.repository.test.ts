import { DataSource } from 'typeorm';
import { v4 } from 'uuid';

import { FolderItemFactory, TagCategory } from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource';
import { IllegalArgumentException } from '../../../../repositories/errors';
import { saveTag } from '../../../tag/fixtures/utils';
import { Item } from '../../entities/Item';
import { ItemTag } from './ItemTag.entity';
import { ItemTagRepository } from './ItemTag.repository';
import { TAG_COUNT_MAX_RESULTS } from './constants';
import { ItemTagAlreadyExists } from './errors';

describe('ItemTag Repository', () => {
  let db: DataSource;
  let repository: ItemTagRepository;

  let itemTagRawRepository;
  let itemRawRepository;

  beforeAll(async () => {
    db = await AppDataSource.initialize();
    await db.runMigrations();
    repository = new ItemTagRepository(db.manager);
    itemTagRawRepository = db.getRepository(ItemTag);
    itemRawRepository = db.getRepository(Item);
  });

  afterAll(async () => {
    await db.dropDatabase();
    await db.destroy();
  });

  describe('getCountBy', () => {
    it('throw for empty search', async () => {
      await expect(() =>
        repository.getCountBy({
          search: '',
          category: TagCategory.Discipline,
        }),
      ).rejects.toBeInstanceOf(IllegalArgumentException);
    });
    it('return empty count for empty set', async () => {
      expect(
        await repository.getCountBy({
          search: 'search',
          category: TagCategory.Discipline,
        }),
      ).toHaveLength(0);
    });
    it('get count for tags given search and category', async () => {
      const category = TagCategory.Discipline;
      const tag = await saveTag({ category });
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));
      await itemTagRawRepository.save({ item, tag });
      const tag1 = await saveTag({ name: tag.name + ' second', category });
      const item1 = await itemRawRepository.save(FolderItemFactory({ creator: null }));
      await itemTagRawRepository.save({ item: item1, tag: tag1 });
      await itemTagRawRepository.save({ item, tag: tag1 });

      // noise
      const tag2 = await saveTag({ name: tag.name + ' second', category: TagCategory.Level });
      await itemTagRawRepository.save({ item: item1, tag: tag2 });

      const tags = await repository.getCountBy({
        search: tag.name,
        category,
      });
      expect(tags).toHaveLength(2);
      expect(tags.find(({ name }) => tag.name === name)!.count).toEqual(1);
      expect(tags.find(({ name }) => tag1.name === name)!.count).toEqual(2);
    });

    it('get count for tags given search without category', async () => {
      const tag = await saveTag();
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));
      await itemTagRawRepository.save({ item, tag });
      const tag1 = await saveTag({ name: tag.name + ' second' });
      const item1 = await itemRawRepository.save(FolderItemFactory({ creator: null }));
      await itemTagRawRepository.save({ item: item1, tag: tag1 });
      await itemTagRawRepository.save({ item, tag: tag1 });

      const tags = await repository.getCountBy({
        search: tag.name,
      });
      expect(tags).toHaveLength(2);
      expect(tags.find(({ name }) => tag.name === name)!.count).toEqual(1);
      expect(tags.find(({ name }) => tag1.name === name)!.count).toEqual(2);
    });

    it(`get max ${TAG_COUNT_MAX_RESULTS} counts for tags`, async () => {
      const category = TagCategory.Discipline;
      // create more tags and association than limit
      const promises = Array.from({ length: TAG_COUNT_MAX_RESULTS + 13 }, async (_, idx) => {
        const tag = await saveTag({ name: 'tag' + idx, category });
        for (let i = 0; i < idx; i++) {
          const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));
          await itemTagRawRepository.save({ item, tag });
        }
        return tag;
      });
      const tags = await Promise.all(promises);

      const result = await repository.getCountBy({
        search: 'tag',
        category,
      });
      // should have only max number of counts
      expect(result).toHaveLength(TAG_COUNT_MAX_RESULTS);

      // last tags in the array are the most used
      for (const t of tags.slice(-TAG_COUNT_MAX_RESULTS)) {
        expect(result.find(({ name }) => t.name === name)!.count).toBeGreaterThan(1);
      }
    });
  });

  describe('getForItem', () => {
    it('throw for invalid item id', async () => {
      await expect(() => repository.getByItemId(undefined!)).rejects.toBeInstanceOf(
        IllegalArgumentException,
      );
    });
    it('return empty tags for non-existing item', async () => {
      expect(await repository.getByItemId(v4())).toHaveLength(0);
    });
    it('get empty tags for item', async () => {
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));

      const tags = await repository.getByItemId(item.id);
      expect(tags).toHaveLength(0);
    });

    it('get tags for item', async () => {
      // save item with tags
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));
      const tag1 = await saveTag();
      const tag2 = await saveTag();
      await itemTagRawRepository.save({ item, tag: tag1 });
      await itemTagRawRepository.save({ item, tag: tag2 });

      // noise
      const anotherTag = await saveTag();
      const anotherItem = await itemRawRepository.save(FolderItemFactory({ creator: null }));
      await itemTagRawRepository.save({ item: anotherItem, tag: anotherTag });

      const tags = await repository.getByItemId(item.id);
      expect(tags).toEqual(expect.arrayContaining([tag1, tag2]));
    });
  });

  describe('createForItem', () => {
    it('throw for invalid item id', async () => {
      const tag = await saveTag();
      await expect(() => repository.create(undefined!, tag.id)).rejects.toThrow();
    });
    it('throw for invalid tag id', async () => {
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));

      await expect(() => repository.create(item.id, undefined!)).rejects.toThrow();
    });
    it('throw for non-existing item', async () => {
      const tag = await saveTag();
      await expect(() => repository.create(v4(), tag.id)).rejects.toThrow();
    });
    it('throw for non-existing tag', async () => {
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));

      await expect(() => repository.create(item.id, v4())).rejects.toThrow();
    });
    it('create tag for item', async () => {
      const tag = await saveTag();
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));

      await repository.create(item.id, tag.id);

      const result = await itemTagRawRepository.findOneBy({ itemId: item.id, tagId: tag.id });
      expect(result).toBeDefined();
    });
    it('throw if tag already exists for item', async () => {
      const tag = await saveTag();
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));
      await itemTagRawRepository.save({ tag, item });

      await expect(() => repository.create(item.id, tag.id)).rejects.toBeInstanceOf(
        ItemTagAlreadyExists,
      );
    });
  });
  describe('delete', () => {
    it('throw for invalid item id', async () => {
      const tag = await saveTag();
      await expect(() => repository.delete(undefined!, tag.id)).rejects.toThrow();
    });
    it('throw for invalid tag id', async () => {
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));

      await expect(() => repository.delete(item.id, undefined!)).rejects.toThrow();
    });
    it('does not throw for non-existing item', async () => {
      const tag = await saveTag();
      expect(await repository.delete(v4(), tag.id)).toBeUndefined();
    });
    it('does not throw for non-existing tag', async () => {
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));

      expect(await repository.delete(item.id, v4())).toBeUndefined();
    });
    it('does not throw if tag is not associated with item', async () => {
      const tag = await saveTag();
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));

      expect(await repository.delete(item.id, tag.id)).toBeUndefined();
    });
    it('delete tag for item', async () => {
      const tag = await saveTag();
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));
      await itemTagRawRepository.save({ tag, item });

      // noise
      const tag1 = await saveTag();
      await itemTagRawRepository.save({ tag: tag1, item });
      const preResult = await itemTagRawRepository.findOneBy({ itemId: item.id, tagId: tag.id });
      expect(preResult).not.toBeNull();

      await repository.delete(item.id, tag.id);

      const result = await itemTagRawRepository.findOneBy({ itemId: item.id, tagId: tag.id });
      expect(result).toBeNull();

      // noise still exists
      const result1 = await itemTagRawRepository.findOne({
        where: { itemId: item.id, tagId: tag1.id },
        relations: { tag: true },
      });
      expect(result1.tag.id).toEqual(tag1.id);
    });
  });
});
