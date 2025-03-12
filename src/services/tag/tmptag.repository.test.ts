import { and, eq } from 'drizzle-orm/sql';
import { v4 } from 'uuid';

import { TagCategory, TagFactory } from '@graasp/sdk';

import { client, db } from '../../drizzle/db';
import { tags } from '../../drizzle/schema';
import { IllegalArgumentException } from '../../repositories/errors';
import { saveTag } from './fixtures/utils';
import { TagRepository } from './tmptag.repository';

const repository = new TagRepository();

describe('Tag Repository', () => {
  beforeAll(async () => {
    await client.connect();
  });
  afterAll(async () => {
    await client.end();
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
      // noise
      await saveTag({ category: TagCategory.Discipline });

      const tag = await saveTag({ category: TagCategory.Discipline });

      // noise
      await saveTag({ category: TagCategory.ResourceType });

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

      const result = await db.query.tags.findFirst({
        where: and(eq(tags.name, tag.name), eq(tags.category, tag.category)),
      });
      expect(result!.name).toEqual(tag.name);
      expect(result!.category).toEqual(tag.category);
    });
    it('cannot insert tag with sanitized name', async () => {
      const tag = TagFactory({ name: 'my name1', category: TagCategory.Discipline });
      await saveTag(tag);

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
      const tagInfo = TagFactory();
      const tag = await saveTag(tagInfo);

      const result = await repository.addOneIfDoesNotExist(db, tagInfo);

      expect(result.id).toEqual(tag.id);
      expect(result.name).toEqual(tag.name);
      expect(result.category).toEqual(tag.category);
    });
    it('return tag with sanitized name', async () => {
      const tag = await saveTag({ name: 'my name2', category: TagCategory.Discipline });
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
