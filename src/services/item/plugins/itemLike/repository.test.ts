import { v4 } from 'uuid';

import { FolderItemFactory, MemberFactory } from '@graasp/sdk';

import { client, db } from '../../../../drizzle/db';
import { IllegalArgumentException } from '../../../../repositories/errors';
import { ItemLikeRepository } from './repository';

const repository = new ItemLikeRepository();

describe('Tag Repository', () => {
  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  describe('getByItemIdId', () => {
    it('throw for invalid id', async () => {
      await expect(() => repository.getByItemId(db, undefined!)).rejects.toBeInstanceOf(
        IllegalArgumentException,
      );
    });
    it('Return null for non-existing item', async () => {
      expect(await repository.getByItemId(db, v4())).toEqual([]);
    });
    it('Return null for no like for item', async () => {
      expect(await repository.getByItemId(db, v4())).toEqual([]);
    });
    it('get likes', async () => {
      const item = await saveItem(FolderItemFactory({ creator: null }));
      const creator = await memberRawRepository.save(MemberFactory());
      const l1 = await likeRawRepository.save({ item, creator });
      const creator1 = await memberRawRepository.save(MemberFactory());
      const l2 = await likeRawRepository.save({ item, creator: creator1 });

      const result = await repository.getByItemId(db, item.id);
      expect(result).toHaveLength(2);
      [l1, l2].forEach((like) => {
        // should contain item
        expect(result.find(({ id }) => id === like.id)!.item.id).toEqual(like.item.id);
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
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));
      const creator = await memberRawRepository.save(MemberFactory());
      await likeRawRepository.save({ item, creator });
      const creator1 = await memberRawRepository.save(MemberFactory());
      await likeRawRepository.save({ item, creator: creator1 });

      expect(await repository.getCountByItemId(db, item.id)).toEqual(2);
    });
  });
});
