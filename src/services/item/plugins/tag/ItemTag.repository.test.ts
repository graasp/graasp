import { DataSource } from 'typeorm';
import { v4 } from 'uuid';

import { FolderItemFactory } from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource';
import { IllegalArgumentException } from '../../../../repositories/errors';
import { Item } from '../../entities/Item';
import { ItemTag } from './ItemTag.entity';
import { ItemTagRepository } from './ItemTag.repository';
import { Tag } from './Tag.entity';
import { ItemTagAlreadyExists } from './errors';
import { TagFactory } from './test/fixtures';

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
    it('throw for non-existing item', async () => {
      expect(() => repository.getForItem(v4())).rejects.toThrow();
    });
    it('get empty tags for item', async () => {
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));

      const tags = await repository.getForItem(item.id);
      expect(tags).toHaveLength(0);
    });

    it('get tags for item', async () => {
      // save item with tags
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));
      const tag1 = await tagRawRepository.save(TagFactory());
      const tag2 = await tagRawRepository.save(TagFactory());
      await itemTagRawRepository.save({ item, tag: tag1 });
      await itemTagRawRepository.save({ item, tag: tag2 });

      // noise
      const anotherTag = await tagRawRepository.save(TagFactory());
      const anotherItem = await itemRawRepository.save(FolderItemFactory({ creator: null }));
      await itemTagRawRepository.save({ item: anotherItem, tag: anotherTag });

      const tags = await repository.getForItem(item.id);
      expect(tags).toEqual([tag1, tag2]);
    });
  });

  describe('createForItem', () => {
    it('throw for invalid item id', async () => {
      const tag = await tagRawRepository.save(TagFactory());
      expect(() => repository.createForItem(undefined!, tag.id)).rejects.toThrow();
    });
    it('throw for invalid tag id', async () => {
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));

      expect(() => repository.createForItem(item.id, undefined!)).rejects.toThrow();
    });
    it('throw for non-existing item', async () => {
      const tag = await tagRawRepository.save(TagFactory());
      expect(() => repository.createForItem(v4(), tag.id)).rejects.toThrow();
    });
    it('throw for non-existing tag', async () => {
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));

      expect(() => repository.createForItem(item.id, v4())).rejects.toThrow();
    });
    it('create tag for item', async () => {
      const tag = await tagRawRepository.save(TagFactory());
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));

      await repository.createForItem(item.id, tag.id);

      const result = await itemTagRawRepository.findOneBy({ itemId: item.id, tagId: tag.id });
      expect(result).toBeDefined();
    });
    it('throw if tag already exists for item', async () => {
      const tag = await tagRawRepository.save(TagFactory());
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));
      await itemTagRawRepository.save({ tag, item });

      expect(() => repository.createForItem(item.id, tag.id)).rejects.toBeInstanceOf(
        ItemTagAlreadyExists,
      );
    });
  });
});
