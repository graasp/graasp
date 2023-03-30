import { StatusCodes } from 'http-status-codes';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../test/app';
import { expectManyItems } from '../../../test/fixtures/items';
import { BOB, saveMember } from '../../../test/fixtures/members';
import { saveItemAndMembership } from '../../../test/fixtures/memberships';
import { MemberCannotAccess } from '../../util/graasp-error';
import { Item } from '../item/entities/Item';
import { setItemPublic } from '../itemTag/test/fixtures';
import { Member } from '../member/entities/member';
import { ItemLikeNotFound } from './errors';
import { ItemLike } from './itemLike';
import { ItemLikeRepository } from './repository';

// mock datasource
jest.mock('../../plugins/datasource');

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

const saveItemLikes = async (items: Item[], member: Member) => {
  const likes: ItemLike[] = [];
  for (const item of items) {
    const like = await ItemLikeRepository.save({ item, creator: member });
    likes.push(like);
  }
  return likes;
};

const getFullItemLike = (id) => {
  return ItemLikeRepository.findOne({ where: { id }, relations: { item: true, creator: true } });
};

describe('Item Like', () => {
  let app;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('GET /:memberId/liked', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember(BOB);

      const response = await app.inject({
        method: 'GET',
        url: `/items/${member.id}/liked`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Get item likes of a user', async () => {
        const { item: item1 } = await saveItemAndMembership({ member: actor });
        const { item: item2 } = await saveItemAndMembership({ member: actor });
        const items = [item1, item2];
        await saveItemLikes(items, actor);

        const res = await app.inject({
          method: 'GET',
          url: `/items/${actor.id}/liked`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);

        // check returned items
        expectManyItems(res.json(), items, actor);
      });

      it('Bad request if id is invalid', async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/items/invalid-id/liked',
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('GET /:itemId/likes', () => {
    describe('Signed Out', () => {
      let member;
      beforeEach(async () => {
        ({ app } = await build({ member: null }));
        member = await saveMember(BOB);
      });

      it('Throws if signed out', async () => {
        ({ app } = await build({ member: null }));

        const response = await app.inject({
          method: 'GET',
          url: `/items/${member.id}/likes`,
        });

        expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });

    // TODO: public - enable when prehook is removed
    //   it.only('Get like entries for public item', async () => {

    //     const {item} = await saveItemAndMembership({member});
    //     await setItemPublic(item, member);
    //     const likes= await saveItemLikes([item], member);
    //     const res = await app.inject({
    //       method: 'GET',
    //       url: `/items/${item.id}/likes`,
    //     });
    //     expect(res.statusCode).toBe(StatusCodes.OK);

    //     // get item like from repository with item (not returned in request)
    //     const fullItemLike = await getFullItemLike(res.json().id);
    //     expectItemLike(fullItemLike!,likes[0]);
    //   });
    // });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Get like entries for item', async () => {
        const { item: item1 } = await saveItemAndMembership({ member: actor });
        const { item: item2 } = await saveItemAndMembership({ member: actor });
        const items = [item1, item2];
        const likes = await saveItemLikes(items, actor);
        const res = await app.inject({
          method: 'GET',
          url: `/items/${item1.id}/likes`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);

        // get item like from repository with item (not returned in request)
        const fullItemLike = await getFullItemLike(res.json().id);
        expectItemLike(fullItemLike!, likes[0]);
      });

      it('Cannot get like item if does not have rights', async () => {
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({ member });
        await saveItemLikes([item], member);

        const res = await app.inject({
          method: 'GET',
          url: `/items/${item.id}/likes`,
        });
        expect(res.json()).toEqual(new MemberCannotAccess(item.id));
      });

      it('Get like entries for public item', async () => {
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({ member });
        await setItemPublic(item, member);
        const likes = await saveItemLikes([item], member);
        const res = await app.inject({
          method: 'GET',
          url: `/items/${item.id}/likes`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);

        // get item like from repository with item (not returned in request)
        const fullItemLike = await getFullItemLike(res.json().id);
        expectItemLike(fullItemLike!, likes[0]);
      });
    });

    it('Bad request if id is invalid', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/items/invalid-id/likes',
      });
      expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  describe('POST /:itemId/like', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember(BOB);
      const { item } = await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items/${item.id}/like`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Create like record', async () => {
        const { item } = await saveItemAndMembership({ member: actor });

        const res = await app.inject({
          method: HttpMethod.POST,
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
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({ member });

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `/items/${item.id}/like`,
        });
        expect(res.json()).toEqual(new MemberCannotAccess(item.id));
      });

      it('Bad request if id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.POST,
          url: '/items/invalid-id/like',
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('DELETE :itemId/like', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember(BOB);
      const { item } = await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/items/${item.id}/like`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Delete item like', async () => {
        const { item } = await saveItemAndMembership({ member: actor });
        const [itemLike] = await saveItemLikes([item], actor);

        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `/items/${item.id}/like`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.body).toEqual(itemLike.id);
      });

      it('Cannot dislike if have no rights on item', async () => {
        const member = await saveMember(BOB);

        const { item } = await saveItemAndMembership({ member });
        const [itemLike] = await saveItemLikes([item], member);

        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `/items/${item.id}/like`,
        });
        expect(res.json()).toEqual(new MemberCannotAccess(item.id));

        // check item like still exists in db
        const savedItemLike = await getFullItemLike(itemLike.id);
        expect(savedItemLike).toBeTruthy();
      });

      it('Cannot delete item like if did not like', async () => {
        const { item } = await saveItemAndMembership({ member: actor });

        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `/items/${item.id}/like`,
        });
        expect(res.json()).toEqual(new ItemLikeNotFound({ creatorId: actor.id, itemId: item.id }));
      });

      it('Bad request if item id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: '/items/invalid-id/like',
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
