/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../test/app';
import { MemberCannotAccess } from '../../../../../utils/errors';
import { Member } from '../../../../member/entities/member';
import { saveMember } from '../../../../member/test/fixtures/members';
import { ItemTestUtils, expectManyPackedItems } from '../../../test/fixtures/items';
import { setItemPublic } from '../../itemTag/test/fixtures';
import { ItemLikeNotFound } from '../errors';
import { ItemLike } from '../itemLike';
import { ItemLikeRepository } from '../repository';
import { saveItemLikes } from './utils';

const testUtils = new ItemTestUtils();

export const expectItemLike = (newLike: ItemLike, correctLike: ItemLike, creator?: Member) => {
  expect(newLike.item.id).toEqual(correctLike.item.id);

  if (newLike.creator && creator) {
    expect(newLike.creator.id).toEqual(creator.id);
  }
};

export const expectManyItemLikes = (
  newLikes: ItemLike[],
  correctLikes: ItemLike[],
  creator?: Member,
) => {
  expect(newLikes).toHaveLength(correctLikes.length);
  newLikes.forEach((l) => {
    const like = correctLikes.find(({ id }) => id === l.id);
    if (!like) {
      throw new Error('Cannot find like for test');
    }
    expectItemLike(l, like, creator);
  });
};

const getFullItemLike = (id) => {
  return new ItemLikeRepository().getOne(id);
};

describe('Item Like', () => {
  let app: FastifyInstance;
  let actor;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
    actor = null;
  });

  describe('GET /liked', () => {
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/items/liked',
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Get item likes of a user', async () => {
        const { item: item1, packedItem: packedItem1 } = await testUtils.saveItemAndMembership({
          member: actor,
        });
        const { item: item2, packedItem: packedItem2 } = await testUtils.saveItemAndMembership({
          member: actor,
        });
        const items = [item1, item2];
        await saveItemLikes(items, actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: '/items/liked',
        });

        expect(res.statusCode).toBe(StatusCodes.OK);

        // check returned items
        expectManyPackedItems(
          res.json().map(({ item }) => item),
          [packedItem1, packedItem2],
          actor,
        );
      });

      it('Get item likes of a user without trashed items', async () => {
        const { item: item1 } = await testUtils.saveItemAndMembership({
          member: actor,
        });
        const { item: item2, packedItem: packedItem2 } = await testUtils.saveItemAndMembership({
          member: actor,
        });
        const items = [item1, item2];
        await saveItemLikes(items, actor);
        // mimic putting an item in the trash by softRemoving it
        await testUtils.rawItemRepository.softDelete(item1.id);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: '/items/liked',
        });

        expect(res.statusCode).toBe(StatusCodes.OK);

        // check returned items
        expectManyPackedItems(
          res.json().map(({ item }) => item),
          [packedItem2],
          actor,
        );
      });
    });
  });

  describe('GET /:itemId/likes', () => {
    describe('Signed Out', () => {
      let member;
      beforeEach(async () => {
        member = await saveMember();
      });

      it('Throws if signed out', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member });
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}/likes`,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });
    });

    describe('Public', () => {
      let member;
      beforeEach(async () => {
        member = await saveMember();
      });

      it('Get like entries for public item', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member });
        await setItemPublic(item, member);
        const likes = await saveItemLikes([item], member);
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}/likes`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        // get item like from repository with item (not returned in request)
        const fullItemLike = await getFullItemLike(res.json()[0].id);
        expectItemLike(fullItemLike!, likes[0]);
      });

      it('Get like entries for public item in the trash', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member });
        await setItemPublic(item, member);
        await saveItemLikes([item], member);
        // mimic putting an item in the trash by softDeleting it
        await testUtils.rawItemRepository.softDelete(item.id);
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}/likes`,
        });
        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
      });
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Get like entries for item', async () => {
        const { item: item1 } = await testUtils.saveItemAndMembership({ member: actor });
        const { item: item2 } = await testUtils.saveItemAndMembership({ member: actor });
        const items = [item1, item2];
        const likes = await saveItemLikes(items, actor);
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item1.id}/likes`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        // get item like from repository with item (not returned in request)
        const fullItemLike = await getFullItemLike(res.json()[0].id);
        expectItemLike(fullItemLike!, likes.find(({ item }) => item.id === item1.id)!);
      });

      it('Cannot get like item if does not have rights', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member });
        await saveItemLikes([item], member);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}/likes`,
        });
        expect(res.json()).toEqual(new MemberCannotAccess(item.id));
      });

      it('Get like entries for public item', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member });
        await setItemPublic(item, member);
        const likes = await saveItemLikes([item], member);
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}/likes`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);

        // get item like from repository with item (not returned in request)
        const fullItemLike = await getFullItemLike(res.json()[0].id);
        expectItemLike(fullItemLike!, likes[0]);
      });
    });

    it('Bad request if id is invalid', async () => {
      const res = await app.inject({
        method: HttpMethod.Get,
        url: '/items/invalid-id/likes',
      });
      expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  describe('POST /:itemId/like', () => {
    it('Throws if signed out', async () => {
      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/like`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Create like record', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member: actor });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `/items/${item.id}/like`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        // check received item like
        // since we don't have full item, deduce from saved value
        const itemLike = res.json();
        const saved = await getFullItemLike(itemLike.id);
        expect(itemLike.id).toEqual(saved!.id);
        expect(saved!.item.id).toEqual(item.id);
        expect(saved!.creator.id).toEqual(actor.id);
      });

      it('Cannot like item if does not have rights', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `/items/${item.id}/like`,
        });
        expect(res.json()).toEqual(new MemberCannotAccess(item.id));
      });

      it('Bad request if id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Post,
          url: '/items/invalid-id/like',
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('DELETE :itemId/like', () => {
    it('Throws if signed out', async () => {
      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/items/${item.id}/like`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Delete item like', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const [itemLike] = await saveItemLikes([item], actor);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `/items/${item.id}/like`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.body).toEqual(itemLike.id);
      });

      it('Cannot dislike if have no rights on item', async () => {
        const member = await saveMember();

        const { item } = await testUtils.saveItemAndMembership({ member });
        const [itemLike] = await saveItemLikes([item], member);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `/items/${item.id}/like`,
        });
        expect(res.json()).toEqual(new MemberCannotAccess(item.id));

        // check item like still exists in db
        const savedItemLike = await getFullItemLike(itemLike.id);
        expect(savedItemLike).toBeTruthy();
      });

      it('Cannot delete item like if did not like', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member: actor });

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `/items/${item.id}/like`,
        });
        expect(res.json()).toEqual(new ItemLikeNotFound({ creatorId: actor.id, itemId: item.id }));
      });

      it('Bad request if item id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Delete,
          url: '/items/invalid-id/like',
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
