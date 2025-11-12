import { v4 } from 'uuid';
import { describe, expect, it } from 'vitest';

import { FolderItemFactory } from '@graasp/sdk';

import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { itemLikesTable } from '../../../../drizzle/schema';
import { IllegalArgumentException } from '../../../../repositories/errors';
import { ItemLikeRepository } from './itemLike.repository';

const repository = new ItemLikeRepository();

describe('ItemLike Repository', () => {
  describe('getByItemIdId', () => {
    it('throw for invalid id', async () => {
      await expect(async () => await repository.getByItemId(db, undefined!)).rejects.toBeInstanceOf(
        IllegalArgumentException,
      );
    });
    it('Return empty array for non-existing item', async () => {
      expect(await repository.getByItemId(db, v4())).toEqual([]);
    });
    it('Return empty array for no likes on item', async () => {
      expect(await repository.getByItemId(db, v4())).toEqual([]);
    });
    it('get likes', async () => {
      const {
        items: [item],
        members: [creator, other],
      } = await seedFromJson({
        items: [FolderItemFactory({ creator: null })],
        members: [{}, {}],
      });
      const likes = await db
        .insert(itemLikesTable)
        .values([
          { itemId: item.id, creatorId: creator.id },
          { itemId: item.id, creatorId: other.id },
        ])
        .returning();

      const result = await repository.getByItemId(db, item.id);
      expect(result).toHaveLength(2);
      likes.forEach((like) => {
        // should contain item
        expect(result.find(({ id }) => id === like.id)!.item.id).toEqual(like.itemId);
      });
    });
  });

  describe('getCountByItemId', () => {
    it('throw for invalid id', async () => {
      await expect(() => repository.getCountByItemId(db, undefined!)).rejects.toBeInstanceOf(
        IllegalArgumentException,
      );
    });
    it('Return 0 for non-existing item', async () => {
      expect(await repository.getCountByItemId(db, v4())).toEqual(0);
    });
    it('Return 0 for no like for item', async () => {
      expect(await repository.getCountByItemId(db, v4())).toEqual(0);
    });
    it('get like count', async () => {
      const {
        items: [item],
        members: [creator, other],
      } = await seedFromJson({
        items: [FolderItemFactory({ creator: null })],
        members: [{}, {}],
      });
      // save 2 likes by different members
      await db
        .insert(itemLikesTable)
        .values([
          { itemId: item.id, creatorId: creator.id },
          { itemId: item.id, creatorId: other.id },
        ])
        .returning();

      expect(await repository.getCountByItemId(db, item.id)).toEqual(2);
    });
  });
});
