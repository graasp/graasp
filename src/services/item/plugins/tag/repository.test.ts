import { DataSource } from 'typeorm';

import { FolderItemFactory, TagCategory } from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource';
import { IllegalArgumentException } from '../../../../repositories/errors';
import { Item } from '../../entities/Item';
import { ItemTag } from './ItemTag.entity';
import { Tag } from './Tag.entity';
import { ItemTagRepository } from './repository';

describe('ItemTag Repository', () => {
  let db: DataSource;
  let repository: ItemTagRepository;

  let itemTagRawRepository;
  let tagRawRepository;
  let itemRawRepository;

  beforeAll(async () => {
    db = await AppDataSource.initialize();
    await db.runMigrations();
    repository = new ItemTagRepository(db.manager);
    itemTagRawRepository = db.getRepository(ItemTag);
    tagRawRepository = db.getRepository(Tag);
    itemRawRepository = db.getRepository(Item);
  });

  afterAll(async () => {
    await db.dropDatabase();
    await db.destroy();
  });

  describe('getForItem', () => {
    it('throw for invalid item id', async () => {
      expect(() => repository.getForItem(undefined!)).rejects.toBeInstanceOf(
        IllegalArgumentException,
      );
    });
    it('get empty tags for item', async () => {
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));

      const tags = await repository.getForItem(item.id);
      expect(tags).toHaveLength(0);
    });

    it('get tags for item', async () => {
      // save item with tags
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));
      const tag1 = await tagRawRepository.save({ name: 'tag1', category: TagCategory.Discipline });
      const tag2 = await tagRawRepository.save({ name: 'tag2', category: TagCategory.Discipline });
      await itemTagRawRepository.save({ item, tag: tag1 });
      await itemTagRawRepository.save({ item, tag: tag2 });

      // noise
      const anotherTag = await tagRawRepository.save({
        name: 'another-tag',
        category: TagCategory.Discipline,
      });
      const anotherItem = await itemRawRepository.save(FolderItemFactory({ creator: null }));
      await itemTagRawRepository.save({ item: anotherItem, tag: anotherTag });

      const tags = await repository.getForItem(item.id);
      expect(tags).toEqual([tag1, tag2]);
    });
  });
});
