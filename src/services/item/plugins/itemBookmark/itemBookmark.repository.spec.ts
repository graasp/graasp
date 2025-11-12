import { v4 } from 'uuid';
import { describe, expect, it } from 'vitest';

import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { itemBookmarksTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { DuplicateBookmarkError, ItemBookmarkNotFound } from './errors';
import { ItemBookmarkRepository } from './itemBookmark.repository';

const repository = new ItemBookmarkRepository();

async function prepareTest() {
  const {
    items,
    actor,
    members: [m1],
  } = await seedFromJson({
    items: [{ creator: 'actor' }, { creator: 'actor' }],
    members: [{}],
  });
  expect(actor).toBeDefined();
  assertIsDefined(actor);
  const favorites = await db
    .insert(itemBookmarksTable)
    .values(items.map((i) => ({ itemId: i.id, memberId: actor.id })))
    .returning();

  // noise
  await repository.post(db, items[0].id, m1.id);

  return { favorites, items, actor };
}

describe('ItemBookmark Repository', () => {
  describe('get', () => {
    it('returns favorite by id', async () => {
      const { favorites } = await prepareTest();
      const f = favorites[0];
      const result = await repository.get(db, f.id);
      expect(result.item.id).toEqual(f.itemId);
    });

    it('throws if id is undefined', async () => {
      await expect(
        async () =>
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          await repository.get(db, undefined!),
      ).rejects.toMatchObject(new ItemBookmarkRepository());
    });

    it('throws if favorite does not exist', async () => {
      const id = v4();
      await expect(async () => await repository.get(db, id)).rejects.toThrow(
        new ItemBookmarkNotFound(id),
      );
    });
  });

  describe('getFavoriteForMember', () => {
    it('returns all favorites for member', async () => {
      const { actor, favorites } = await prepareTest();
      const result = await repository.getBookmarksForMember(db, actor.id);
      expect(result).toHaveLength(favorites.length);
      for (const f of favorites) {
        const match = result.find((r) => r.id === f.id);
        expect(match).toBeDefined();
        expect(match?.item.id).toEqual(f.itemId);
        // creator is not included in the return
      }
    });

    it('returns empty array if no favorite', async () => {
      const result = await repository.getBookmarksForMember(db, v4());
      expect(result).toHaveLength(0);
    });
  });

  describe('post', () => {
    it('save and return favorite', async () => {
      const { actor } = await prepareTest();
      // create a new item
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });

      // returned value
      const result = await repository.post(db, item.id, actor.id);
      expect(result).toBeDefined();
      expect(result.itemId).toEqual(item.id);
      assertIsDefined(result);
      const resId = result.id;
      assertIsDefined(resId);
      // saved value
      expect(await repository.get(db, resId)).toMatchObject({
        item: expect.objectContaining({ id: item.id }),
      });
    });

    it('throws if duplicate', async () => {
      const { favorites } = await prepareTest();
      await expect(
        async () => await repository.post(db, favorites[0].itemId, favorites[0].memberId),
      ).rejects.toThrow(
        new DuplicateBookmarkError({
          itemId: favorites[0].itemId,
          memberId: favorites[0].memberId,
        }),
      );
    });
  });

  describe('deleteOne', () => {
    it('delete favorite', async () => {
      const { favorites } = await prepareTest();
      const f = favorites[0];
      // returned value
      const result = await repository.deleteOne(db, f.itemId, f.memberId);
      expect(result).toEqual(f.itemId);

      // saved value
      await expect(async () => await repository.get(db, f.id)).rejects.toThrow(
        new ItemBookmarkNotFound(f.id),
      );
    });

    it('do nothing if no favorite exists', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{}] });
      assertIsDefined(actor);
      // returned value
      const result = await repository.deleteOne(db, item.id, actor.id);
      expect(result).toEqual(item.id);
    });
  });
});
