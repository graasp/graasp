import { DataSource } from 'typeorm';
import { v4 } from 'uuid';

import { TagCategory, TagFactory } from '@graasp/sdk';

import { AppDataSource } from '../../plugins/datasource';
import { IllegalArgumentException } from '../../repositories/errors';
import { TagRepository } from './Tag.repository';
import { TagRepositoryForTest } from './fixtures/utils';

describe('Tag Repository', () => {
  let db: DataSource;

  let repository: TagRepository;
  let tagRawRepository: typeof TagRepositoryForTest;

  beforeAll(async () => {
    db = await AppDataSource.initialize();
    await db.runMigrations();
    repository = new TagRepository(db.manager);
    tagRawRepository = db.manager.withRepository(TagRepositoryForTest);
  });

  afterAll(async () => {
    await db.dropDatabase();
    await db.destroy();
  });

  describe('get', () => {
    it('throw for invalid id', async () => {
      await expect(() => repository.get(undefined!)).rejects.toBeInstanceOf(
        IllegalArgumentException,
      );
    });
    it('Return null for non-existing tag', async () => {
      expect(await repository.get(v4())).toBeNull();
    });
    it('get tag', async () => {
      // noise
      await tagRawRepository.saveTag({ category: TagCategory.Discipline });

      const tag = await tagRawRepository.saveTag({ category: TagCategory.Discipline });

      // noise
      await tagRawRepository.saveTag({ category: TagCategory.ResourceType });

      const result = await repository.get(tag.id);
      expect(result!.id).toEqual(tag.id);
      expect(result!.name).toEqual(tag.name);
      expect(result!.category).toEqual(tag.category);
    });
  });

  describe('addOne', () => {
    it('throw for invalid category', async () => {
      await expect(() =>
        repository.addOneIfDoesNotExist(TagFactory({ category: 'category' as never })),
      ).rejects.toThrow();
    });
    it('insert tag', async () => {
      const tag = TagFactory();
      await repository.addOne(tag);

      const result = await tagRawRepository.findOneBy({ name: tag.name, category: tag.category });
      expect(result!.name).toEqual(tag.name);
      expect(result!.category).toEqual(tag.category);
    });
    it('cannot insert tag with sanitized name', async () => {
      const tag = TagFactory({ name: 'my name1', category: TagCategory.Discipline });
      await tagRawRepository.saveTag(tag);

      const tagToAdd = TagFactory({ name: 'my     name1', category: TagCategory.Discipline });
      await expect(() => repository.addOne(tagToAdd)).rejects.toThrow();
    });
  });

  describe('addOneIfDoesNotExist', () => {
    it('throw for invalid category', async () => {
      await expect(() =>
        repository.addOneIfDoesNotExist(TagFactory({ category: 'category' as never })),
      ).rejects.toThrow();
    });
    it('insert tag and return', async () => {
      const tag = TagFactory();
      const result = await repository.addOneIfDoesNotExist(tag);

      expect(result.name).toEqual(tag.name);
      expect(result.category).toEqual(tag.category);
    });
    it('return existing tag', async () => {
      const tagInfo = TagFactory();
      const tag = await tagRawRepository.saveTag(tagInfo);

      const result = await repository.addOneIfDoesNotExist(tagInfo);

      expect(result.id).toEqual(tag.id);
      expect(result.name).toEqual(tag.name);
      expect(result.category).toEqual(tag.category);
    });
    it('return tag with sanitized name', async () => {
      const tag = await tagRawRepository.saveTag({
        name: 'my name2',
        category: TagCategory.Discipline,
      });
      const tagNotSanitized = {
        name: 'my     name2',
        category: TagCategory.Discipline,
      };

      const result = await repository.addOneIfDoesNotExist(tagNotSanitized);
      expect(result.id).toEqual(tag.id);
      expect(result.name).toEqual(tag.name);
      expect(result.category).toEqual(tag.category);
    });
  });
});
