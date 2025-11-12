import { and, eq } from 'drizzle-orm/sql';
import { v4 } from 'uuid';
import { afterEach, describe, expect, it } from 'vitest';

import { TagCategory, type TagCategoryType, TagFactory } from '@graasp/sdk';

import { seedFromJson } from '../../../test/mocks/seed';
import { db } from '../../drizzle/db';
import { tagsTable } from '../../drizzle/schema';
import { IllegalArgumentException } from '../../repositories/errors';
import { TagRepository } from './tag.repository';

const repository = new TagRepository();

describe('Tag Repository', () => {
  afterEach(async () => {
    // delete all tags to prevent adding duplicates
    await db.delete(tagsTable);
  });

  describe('get', () => {
    it('throw for invalid id', async () => {
      await expect(() => repository.get(db, undefined!)).rejects.toBeInstanceOf(
        IllegalArgumentException,
      );
    });
    it('Return null for non-existing tag', async () => {
      expect(await repository.get(db, v4())).toBeUndefined();
    });
    it('get tag', async () => {
      const {
        tags: [tag],
      } = await seedFromJson({
        tags: [
          { category: TagCategory.Discipline },
          { category: TagCategory.Discipline },
          { category: TagCategory.ResourceType },
        ],
      });

      const result = await repository.get(db, tag.id);
      expect(result!.id).toEqual(tag.id);
      expect(result!.name).toEqual(tag.name);
      expect(result!.category).toEqual(tag.category);
    });
  });

  describe('addOne', () => {
    it('throw for invalid category', async () => {
      await expect(() =>
        repository.addOneIfDoesNotExist(db, TagFactory({ category: 'category' as never })),
      ).rejects.toThrow();
    });
    it('insert tag', async () => {
      const tag = TagFactory();
      await repository.addOne(db, tag);

      const result = await db.query.tagsTable.findFirst({
        where: and(eq(tagsTable.name, tag.name), eq(tagsTable.category, tag.category)),
      });
      expect(result!.name).toEqual(tag.name);
      expect(result!.category).toEqual(tag.category);
    });
    it('cannot insert tag with sanitized name', async () => {
      await seedFromJson({
        tags: [{ name: 'my name1', category: TagCategory.Discipline }],
      });

      const tagToAdd = TagFactory({ name: 'my     name1', category: TagCategory.Discipline });
      await expect(() => repository.addOne(db, tagToAdd)).rejects.toThrow();
    });
  });

  describe('addOneIfDoesNotExist', () => {
    it('throw for invalid category', async () => {
      await expect(() =>
        repository.addOneIfDoesNotExist(db, TagFactory({ category: 'category' as never })),
      ).rejects.toThrow();
    });
    it('insert tag and return', async () => {
      const tag = TagFactory();
      const result = await repository.addOneIfDoesNotExist(db, tag);

      expect(result.name).toEqual(tag.name);
      expect(result.category).toEqual(tag.category);
    });
    it('return existing tag', async () => {
      const {
        tags: [tag],
      } = await seedFromJson({
        tags: [{ category: TagCategory.Discipline }],
      });

      const result = await repository.addOneIfDoesNotExist(db, {
        name: tag.name,
        category: tag.category as TagCategoryType,
      });

      expect(result.id).toEqual(tag.id);
      expect(result.name).toEqual(tag.name);
      expect(result.category).toEqual(tag.category);
    });
    it('return tag with sanitized name', async () => {
      const {
        tags: [tag],
      } = await seedFromJson({
        tags: [{ name: 'my name2', category: TagCategory.Discipline }],
      });
      const tagNotSanitized = {
        name: 'my     name2',
        category: TagCategory.Discipline,
      };

      const result = await repository.addOneIfDoesNotExist(db, tagNotSanitized);
      expect(result.id).toEqual(tag.id);
      expect(result.name).toEqual(tag.name);
      expect(result.category).toEqual(tag.category);
    });
  });
});
