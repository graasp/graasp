import { v4 } from 'uuid';

import { clearDatabase } from '../../../../../test/app.js';
import { ItemBookmarkRaw } from '../../../../drizzle/types.js';
import { saveMember } from '../../../member/test/fixtures/members.js';
import { ItemTestUtils } from '../../test/fixtures/items.js';
import { DuplicateBookmarkError, ItemBookmarkNotFound } from './errors.js';
import { ItemBookmarkRepository } from './itemBookmark.repository.js';

const testUtils = new ItemTestUtils();

describe('FavoriteRepository', () => {
  let actor;
  let favorites: ItemBookmarkRaw[];

  beforeEach(async () => {
    const r = new ItemBookmarkRepository();
    const rawRepository = AppDataSource.getRepository(ItemFavorite);
    const item1 = await testUtils.saveItem({ actor });
    const item2 = await testUtils.saveItem({ actor });
    favorites = [
      await rawRepository.save({ item: item1, member: actor }),
      await rawRepository.save({ item: item2, member: actor }),
    ];

    // noise
    const m1 = await saveMember();
    await r.post(app.db, item1.id, m1.id);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    favorites = [];
    app.close();
  });

  describe('get', () => {
    it('returns favorite by id', async () => {
      const r = new ItemBookmarkRepository();
      const f = favorites[0];
      const result = await r.get(f.id);
      expect(result).toMatchObject({
        item: expect.objectContaining({ id: f.item.id }),
      });
    });

    it('throws if id is undefined', async () => {
      const r = new ItemBookmarkRepository();

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await expect(r.get(app.db, undefined!)).rejects.toMatchObject(new ItemBookmarkRepository());
    });

    it('throws if favorite does not exist', async () => {
      const r = new ItemBookmarkRepository();
      const id = v4();
      await expect(r.get(app.db, id)).rejects.toMatchObject(new ItemBookmarkRepository(id));
    });
  });

  describe('getFavoriteForMember', () => {
    it('returns all favorites for member', async () => {
      const r = new ItemBookmarkRepository();

      const result = await r.getFavoriteForMember(app.db, actor.id);
      expect(result).toHaveLength(favorites.length);
      for (const f of favorites) {
        expect(result).toContainEqual(
          expect.objectContaining({
            item: expect.objectContaining({
              id: f.item.id,
              creator: expect.objectContaining({ id: f.item?.creator?.id }),
            }),
          }),
        );
      }
    });

    it('returns empty array if no favorite', async () => {
      const r = new ItemBookmarkRepository();

      const result = await r.getFavoriteForMember(app.db, v4());
      expect(result).toHaveLength(0);
    });
  });

  describe('post', () => {
    it('save and return favorite', async () => {
      const r = new ItemBookmarkRepository();
      const item = await testUtils.saveItem({ actor });

      // returned value
      const result = await r.post(app.db, item.id, actor.id);
      expect(result).toMatchObject({
        item: expect.objectContaining({ id: item.id }),
      });

      // saved value
      expect(await r.get(result.id)).toMatchObject({
        item: expect.objectContaining({ id: item.id }),
      });
    });

    it('throws if duplicate', async () => {
      const r = new ItemBookmarkRepository();

      await expect(r.post(favorites[0].item.id, favorites[0].member.id)).rejects.toMatchObject(
        new DuplicateBookmarkError({
          itemId: favorites[0].item.id,
          memberId: favorites[0].member.id,
        }),
      );
    });
  });

  describe('deleteOne', () => {
    it('delete favorite', async () => {
      const r = new ItemBookmarkRepository();
      const f = favorites[0];
      // returned value
      const result = await r.deleteOne(app.db, f.item.id, f.member.id);
      expect(result).toEqual(f.item.id);

      // saved value
      await expect(r.get(f.id)).rejects.toMatchObject(new ItemBookmarkNotFound(f.id));
    });

    it('do nothing if no favorite exists', async () => {
      const r = new ItemBookmarkRepository();
      const item = await testUtils.saveItem({ actor });

      // returned value
      const result = await r.deleteOne(app.db, item.id, actor.id);
      expect(result).toEqual(item.id);
    });
  });
});
