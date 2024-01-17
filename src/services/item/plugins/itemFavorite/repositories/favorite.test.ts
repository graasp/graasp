import { v4 } from 'uuid';

import build, { clearDatabase } from '../../../../../../test/app';
import { BOB, saveMember } from '../../../../member/test/fixtures/members';
import { getDummyItem, saveItem } from '../../../test/fixtures/items';
import { ItemFavorite } from '../entities/ItemFavorite';
import { DuplicateFavoriteError, ItemFavoriteNotFound } from '../errors';
import { FavoriteRepository } from './favorite';

// mock datasource
jest.mock('../../../../../plugins/datasource');

describe('FavoriteRepository', () => {
  let app;
  let actor;
  let favorites: ItemFavorite[];

  beforeEach(async () => {
    ({ app, actor } = await build());
    const r = new FavoriteRepository();
    const item1 = await saveItem({ actor, item: getDummyItem() });
    const item2 = await saveItem({ actor, item: getDummyItem() });
    favorites = [await r.post(item1.id, actor.id), await r.post(item2.id, actor.id)];

    // noise
    const m1 = await saveMember(BOB);
    await r.post(item1.id, m1.id);
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
      const r = new FavoriteRepository();
      const f = favorites[0];
      const result = await r.get(f.id);
      expect(result).toMatchObject({
        item: expect.objectContaining({ id: f.item.id }),
      });
    });

    it('throws if id is undefined', async () => {
      const r = new FavoriteRepository();

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await expect(r.get(undefined!)).rejects.toMatchObject(new ItemFavoriteNotFound(undefined));
    });

    it('throws if favorite does not exist', async () => {
      const r = new FavoriteRepository();
      const id = v4();
      await expect(r.get(id)).rejects.toMatchObject(new ItemFavoriteNotFound(id));
    });
  });

  describe('getFavoriteForMember', () => {
    it('returns all favorites for member', async () => {
      const r = new FavoriteRepository();

      const result = await r.getFavoriteForMember(actor.id);
      expect(result).toHaveLength(favorites.length);
      for (const f of favorites) {
        expect(result).toContainEqual(
          expect.objectContaining({
            item: expect.objectContaining({ id: f.item.id }),
          }),
        );
      }
    });

    it('returns empty array if no favorite', async () => {
      const r = new FavoriteRepository();

      const result = await r.getFavoriteForMember(v4());
      expect(result).toHaveLength(0);
    });
  });

  describe('post', () => {
    it('save and return favorite', async () => {
      const r = new FavoriteRepository();
      const item = await saveItem({ item: getDummyItem(), actor });

      // returned value
      const result = await r.post(item.id, actor.id);
      expect(result).toMatchObject({
        item: expect.objectContaining({ id: item.id }),
      });

      // saved value
      expect(await r.get(result.id)).toMatchObject({
        item: expect.objectContaining({ id: item.id }),
      });
    });

    it('throws if duplicate', async () => {
      const r = new FavoriteRepository();

      await expect(r.post(favorites[0].item.id, favorites[0].member.id)).rejects.toMatchObject(
        new DuplicateFavoriteError({
          itemId: favorites[0].item.id,
          memberId: favorites[0].member.id,
        }),
      );
    });
  });

  describe('deleteOne', () => {
    it('delete favorite', async () => {
      const r = new FavoriteRepository();
      const f = favorites[0];
      // returned value
      const result = await r.deleteOne(f.item.id, f.member.id);
      expect(result).toEqual(f.item.id);

      // saved value
      await expect(r.get(f.id)).rejects.toMatchObject(new ItemFavoriteNotFound(f.id));
    });

    it('do nothing if no favorite exists', async () => {
      const r = new FavoriteRepository();
      const item = await saveItem({ item: getDummyItem(), actor });

      // returned value
      const result = await r.deleteOne(item.id, actor.id);
      expect(result).toEqual(item.id);
    });
  });
});
