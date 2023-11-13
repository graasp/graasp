import { StatusCodes } from 'http-status-codes';
import { MultiSearchParams } from 'meilisearch';
import qs from 'qs';
import { v4 } from 'uuid';
import waitForExpect from 'wait-for-expect';

import { CategoryType, HttpMethod, ItemTagType, ItemType, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { ItemNotFound, MemberCannotAdminItem } from '../../../../../utils/errors';
import {
  saveItemAndMembership,
  saveMembership,
} from '../../../../itemMembership/test/fixtures/memberships';
import { ANNA, BOB, CEDRIC, saveMember } from '../../../../member/test/fixtures/members';
import { MEMBERS } from '../../../../member/test/fixtures/members';
import { saveMembers } from '../../../../member/test/fixtures/members';
import { Item } from '../../../entities/Item';
import { ItemRepository } from '../../../repository';
import { expectItem, expectManyItems, getDummyItem } from '../../../test/fixtures/items';
import { CategoryRepository } from '../../itemCategory/repositories/category';
import { ItemCategoryRepository } from '../../itemCategory/repositories/itemCategory';
import { saveCategories } from '../../itemCategory/test/index.test';
import { ItemLike } from '../../itemLike/itemLike';
import { saveItemLikes } from '../../itemLike/test/utils';
import { ItemTagNotFound } from '../../itemTag/errors';
import { ItemTagRepository } from '../../itemTag/repository';
import { ItemPublished } from '../entities/itemPublished';
import { ItemPublishedNotFound } from '../errors';
import { MeiliSearchWrapper } from '../plugins/search/meilisearch';
import { ItemPublishedRepository } from '../repositories/itemPublished';

// mock datasource
jest.mock('../../../../../plugins/datasource');

jest.mock('../plugins/search/meilisearch');

const saveCollections = async (member) => {
  const items: Item[] = [];
  for (let i = 0; i < 3; i++) {
    const { item } = await saveItemAndMembership({ member });
    items.push(item);
    await ItemPublishedRepository.save({ item, creator: member });
  }
  return items;
};

const expectPublishedEntry = (value, expectedValue) => {
  expect(value.item.id).toEqual(expectedValue.item.id);
  expect(value.creator.id).toEqual(expectedValue.creator.id);
};

describe('Item Published', () => {
  let app;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('GET /collections', () => {
    describe('Signed Out', () => {
      let member;
      let collections: Item[];
      let categories;

      beforeEach(async () => {
        ({ app } = await build({ member: null }));
        member = await saveMember(BOB);
        collections = await saveCollections(member);
        categories = await saveCategories();

        // add category to a non-published item
        const { item } = await saveItemAndMembership({ member });
        await ItemCategoryRepository.save({ item, category: categories[0] });
      });

      it('Get all published collections', async () => {
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/collections`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectManyItems(res.json(), collections);
      });

      it('Get all published collections even when items are trashed', async () => {
        await ItemRepository.softRemove(collections[0]);
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/collections`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectManyItems(res.json(), collections.slice(1));
      });

      it('Get all published collections without hidden', async () => {
        const hiddenCollection = collections[0];
        await ItemTagRepository.save({
          item: hiddenCollection,
          creator: actor,
          type: ItemTagType.Hidden,
        });
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/collections`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectManyItems(res.json(), collections.slice(1));
      });
      it('Get collections for one category', async () => {
        // set categories to collections
        const result = collections.slice(0, 2);
        const category = categories[0];

        for (const c of result) {
          await ItemCategoryRepository.save({ item: c, category });
        }

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/collections${qs.stringify(
            { categoryId: category.id },
            { addQueryPrefix: true, arrayFormat: 'repeat' },
          )}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectManyItems(res.json(), result);
      });
      it('Get collections with intersection of categories', async () => {
        // set categories to collections
        const selectedCategories = categories.slice(0, 2);
        const result = collections[0];
        for (const category of selectedCategories) {
          await ItemCategoryRepository.save({ item: result, category });
        }
        // add one category to one item
        await ItemCategoryRepository.save({
          item: collections[1],
          category: selectedCategories[1],
        });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/collections${qs.stringify(
            { categoryId: selectedCategories.map(({ id }) => id) },
            { addQueryPrefix: true, arrayFormat: 'repeat' },
          )}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectManyItems(res.json(), [result]);
      });
      it('Get collections with groups of categories', async () => {
        // set categories to collections
        const result = collections.slice(0, 2);
        const selectedCategories = categories.slice(0, 2);

        // add one different category to each item
        for (const item of result) {
          for (const category of selectedCategories) {
            await ItemCategoryRepository.save({ item, category });
          }
        }

        // one random item category
        await ItemCategoryRepository.save({ item: collections[2], category: categories[2] });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/collections${qs.stringify(
            { categoryId: selectedCategories.map(({ id }) => id).join(',') },
            { addQueryPrefix: true, arrayFormat: 'repeat' },
          )}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectManyItems(res.json(), result);
      });
      it('Get child collection with category', async () => {
        // set categories to parent item
        // and publish child
        const category = categories[2];
        const { item: parentItem } = await saveItemAndMembership({ member });
        await ItemCategoryRepository.save({ item: parentItem, category });
        const { item } = await saveItemAndMembership({ member, parentItem });
        await ItemPublishedRepository.save({ item, creator: member });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/collections${qs.stringify(
            { categoryId: category.id },
            { addQueryPrefix: true, arrayFormat: 'repeat' },
          )}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectManyItems(res.json(), [item]);
      });
      it('Get publish info of child item returns root published item', async () => {
        const { item: parentItem } = await saveItemAndMembership({ member });
        const { item } = await saveItemAndMembership({ member, parentItem });
        await ItemTagRepository.post(member, parentItem, ItemTagType.Public);
        // publish parent
        await ItemPublishedRepository.save({ item: parentItem, creator: member });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/informations`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectItem(res.json()?.item, parentItem);
      });
      it('Get publish info of multiple childs returns root published items', async () => {
        const { item: parentItem } = await saveItemAndMembership({ member });
        const { item: otherParentItem } = await saveItemAndMembership({ member });
        const { item } = await saveItemAndMembership({ member, parentItem });
        await ItemTagRepository.post(member, parentItem, ItemTagType.Public);
        await ItemTagRepository.post(member, otherParentItem, ItemTagType.Public);

        // publish parents
        await ItemPublishedRepository.save({ item: parentItem, creator: member });
        await ItemPublishedRepository.save({ item: otherParentItem, creator: member });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/collections/informations${qs.stringify(
            { itemId: [item.id, otherParentItem.id] },
            { addQueryPrefix: true, arrayFormat: 'repeat' },
          )}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        const result = (await res.json().data) as { [key: string]: ItemPublished };
        const items = Object.values(result).map((i) => i.item);
        expectManyItems(items as Item[], [otherParentItem, parentItem]);
      });
      it('Throw if category id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/collections${qs.stringify(
            { categoryId: 'invalid-id' },
            { addQueryPrefix: true, arrayFormat: 'repeat' },
          )}`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('GET /collections/recent', () => {
    describe('Signed Out', () => {
      let member;
      let collections: Item[];

      beforeEach(async () => {
        ({ app } = await build({ member: null }));
        member = await saveMember(BOB);
        collections = await saveCollections(member);
      });

      it('Get 2 most recent collections', async () => {
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/collections/recent`,
          query: { limit: 2 },
        });
        expect(res.statusCode).toBe(StatusCodes.OK);

        const result = collections.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        expectManyItems(res.json(), result.slice(0, -1));
      });

      it('Get recent published collections without hidden', async () => {
        const hiddenCollection = collections[0];
        await ItemTagRepository.save({
          item: hiddenCollection,
          creator: actor,
          type: ItemTagType.Hidden,
        });
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/collections/recent`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);

        expectManyItems(res.json(), collections.slice(1));
      });
    });
  });

  describe('GET /collections/liked', () => {
    describe('Signed Out', () => {
      let members;
      let collections: Item[];
      const likes: ItemLike[] = [];

      beforeEach(async () => {
        ({ app } = await build({ member: null }));
        members = await saveMembers(Object.values(MEMBERS));
        collections = await saveCollections(members[0]);

        // add idx x likes
        for (const [idx, c] of collections.entries()) {
          for (const m of members.slice(idx)) {
            likes.concat(await saveItemLikes([c], m));
          }
        }
      });

      it('Get 2 most liked collections', async () => {
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/collections/liked`,
          query: { limit: 2 },
        });

        const result = collections.slice(0, -1);

        expect(res.statusCode).toBe(StatusCodes.OK);
        expectManyItems(res.json(), result);
      });

      it('Get 2 most liked collections without hidden', async () => {
        // hide first collection
        const hiddenCollection = collections[0];
        await ItemTagRepository.save({
          item: hiddenCollection,
          creator: actor,
          type: ItemTagType.Hidden,
        });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/collections/liked`,
        });

        const result = collections.slice(1);

        expect(res.statusCode).toBe(StatusCodes.OK);
        expectManyItems(res.json(), result);
      });
    });
  });

  describe('GET /collections/members/:memberId', () => {
    describe('Signed Out', () => {
      it('Returns published collections for member', async () => {
        ({ app } = await build({ member: null }));
        const member = await saveMember(BOB);
        const items = await saveCollections(member);
        await saveCategories();

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/collections/members/${member.id}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectManyItems(res.json(), items);
      });
    });

    describe('Signed In', () => {
      let actor;
      let collections;

      beforeEach(async () => {
        ({ app, actor } = await build());
        collections = await saveCollections(actor);
      });

      it('Get published collections for member', async () => {
        // add other collections
        const member = await saveMember(BOB);
        const items = await saveCollections(member);

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/collections/members/${member.id}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectManyItems(res.json(), items);
      });
    });
  });

  describe('POST /collections/:itemId/publish', () => {
    describe('Signed Out', () => {
      it('Throw if signed out', async () => {
        ({ app } = await build({ member: null }));
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({ member });

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed In', () => {
      let actor;

      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Publish item with admin rights', async () => {
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Admin,
        });
        await ItemTagRepository.save({ item, type: ItemTagType.Public, creator: member });

        const indexSpy = jest.spyOn(MeiliSearchWrapper.prototype, 'indexOne');

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectPublishedEntry(res.json(), { item, creator: actor });

        // Publishing an item triggers an indexing
        expect(indexSpy).toHaveBeenCalledTimes(1);
        expect(indexSpy.mock.calls[0][0]).toMatchObject(item);
      });

      it('Publish item with admin rights and send notification', async () => {
        const sendEmailMock = jest.spyOn(app.mailer, 'sendEmail');

        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Admin,
        });
        const anna = await saveMember(ANNA);
        await saveMembership({
          item,
          member: anna,
          permission: PermissionLevel.Admin,
        });
        const cedric = await saveMember(CEDRIC);
        await saveMembership({
          item,
          member: cedric,
          permission: PermissionLevel.Admin,
        });
        await ItemTagRepository.save({ item, type: ItemTagType.Public, creator: member });

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectPublishedEntry(res.json(), { item, creator: actor });

        await waitForExpect(() => {
          expect(sendEmailMock).toHaveBeenCalledTimes(2);
          expect(sendEmailMock).toHaveBeenCalledWith(
            expect.stringContaining(item.name),
            anna.email,
            expect.stringContaining(item.id),
            expect.anything(),
          );
          expect(sendEmailMock).toHaveBeenCalledWith(
            expect.stringContaining(item.name),
            cedric.email,
            expect.stringContaining(item.id),
            expect.anything(),
          );
        }, 1000);
      });

      it('Cannot publish private item', async () => {
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Admin,
        });

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
        expect(res.json()).toMatchObject(new ItemTagNotFound(expect.anything()));
      });

      it('Cannot publish item with write rights', async () => {
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Write,
        });
        await ItemTagRepository.save({ item, type: ItemTagType.Public, creator: member });

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Cannot publish item with read rights', async () => {
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Read,
        });
        await ItemTagRepository.save({ item, type: ItemTagType.Public, creator: member });

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Throws if item id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/collections/invalid-id/publish`,
        });
        expect(res.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item is not found', async () => {
        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${v4()}/publish`,
        });
        expect(res.json()).toMatchObject(new ItemNotFound(expect.anything()));
      });
    });
  });

  describe('DELETE /collections/:itemId/unpublish', () => {
    describe('Signed Out', () => {
      it('Throw if signed out', async () => {
        ({ app } = await build({ member: null }));
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({ member });

        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/unpublish`,
        });
        expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed In', () => {
      let actor;

      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Unpublish item with admin rights', async () => {
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Admin,
        });
        await ItemTagRepository.save({ item, type: ItemTagType.Public, creator: member });
        await ItemPublishedRepository.save({ item, creator: member });

        const indexSpy = jest.spyOn(MeiliSearchWrapper.prototype, 'deleteOne');

        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/unpublish`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectPublishedEntry(res.json(), { item, creator: member });
        expect(indexSpy).toHaveBeenCalledTimes(1);
        expect(indexSpy.mock.calls[0][0]).toMatchObject(item);
      });

      it('Throws when unpublish non-published item', async () => {
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Admin,
        });
        await ItemTagRepository.save({ item, type: ItemTagType.Public, creator: member });

        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/unpublish`,
        });
        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
        expect(res.json()).toMatchObject(new ItemPublishedNotFound(expect.anything()));
      });

      it('Cannot publish item with write rights', async () => {
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Write,
        });
        await ItemTagRepository.save({ item, type: ItemTagType.Public, creator: member });
        await ItemPublishedRepository.save({ item, creator: member });

        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/unpublish`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Cannot publish item with read rights', async () => {
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Read,
        });
        await ItemTagRepository.save({ item, type: ItemTagType.Public, creator: member });
        await ItemPublishedRepository.save({ item, creator: member });

        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/unpublish`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Throws if item id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/collections/invalid-id/unpublish`,
        });
        expect(res.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item is not found', async () => {
        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${v4()}/unpublish`,
        });
        expect(res.json()).toMatchObject(new ItemNotFound(expect.anything()));
      });
    });
  });

  describe('SearchService', () => {
    describe('Signed Out', () => {
      it('Returns search results', async () => {
        ({ app } = await build({ member: null }));

        // Meilisearch is mocked so format of API doesn't matter, we just want it to proxy
        const fakePayload = { queries: [] } as MultiSearchParams;
        const fakeResponse = { results: [] };
        const searchSpy = jest
          .spyOn(MeiliSearchWrapper.prototype, 'search')
          .mockResolvedValue(fakeResponse);

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/collections/search`,
          payload: fakePayload,
        });

        // Check that the body is just proxied
        expect(searchSpy).toHaveBeenCalledWith(fakePayload);
        // Expect result from spied meilisearch
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toEqual(fakeResponse);
      });
    });

    describe('Signed in', () => {
      let actor;

      it('Returns search results', async () => {
        ({ app } = await build());

        // Meilisearch is mocked so format of API doesn't matter, we just want it to proxy
        const fakePayload = { queries: [] } as MultiSearchParams;
        const fakeResponse = { results: [] };
        const searchSpy = jest
          .spyOn(MeiliSearchWrapper.prototype, 'search')
          .mockResolvedValue(fakeResponse);

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/collections/search`,
          payload: fakePayload,
        });

        // Check that the body is just proxied
        expect(searchSpy).toHaveBeenCalledWith(fakePayload);
        // Expect result from spied meilisearch
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toEqual(fakeResponse);
      });

      it('search is delegated to meilisearch SDK with a forced filter', async () => {
        ({ app } = await build());

        const searchSpy = jest.spyOn(MeiliSearchWrapper.prototype, 'search');

        const userQuery: MultiSearchParams = {
          queries: [{ q: 'random query', filter: 'random filter', indexUid: 'index' }],
        };
        const expectedQuery: MultiSearchParams = {
          queries: [
            {
              q: 'random query',
              filter: '(random filter) AND isHidden = false',
              indexUid: 'index',
            },
          ],
        };

        await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/collections/search`,
          payload: userQuery,
        });

        expect(searchSpy).toHaveBeenCalledWith(expectedQuery);
      });

      it('works with empty filters', async () => {
        ({ app } = await build());

        const searchSpy = jest.spyOn(MeiliSearchWrapper.prototype, 'search');

        const userQuery: MultiSearchParams = {
          queries: [{ q: 'random query', indexUid: 'index' }],
        };
        const expectedQuery: MultiSearchParams = {
          queries: [
            {
              q: 'random query',
              filter: 'isHidden = false',
              indexUid: 'index',
            },
          ],
        };

        await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/collections/search`,
          payload: userQuery,
        });

        expect(searchSpy).toHaveBeenCalledWith(expectedQuery);
      });

      it('triggers indexation when item hooks', async () => {
        ({ app, actor } = await build());

        // Start with a published item
        const extra = {
          [ItemType.DOCUMENT]: {
            content: 'my text is here',
          },
        };
        const { item } = await saveItemAndMembership({
          item: getDummyItem({ type: ItemType.DOCUMENT, extra }),
          creator: actor,
          member: actor,
          permission: PermissionLevel.Admin,
        });
        await ItemTagRepository.save({ item, type: ItemTagType.Public, creator: actor });
        await ItemPublishedRepository.save({ item, creator: actor });

        const { item: publishedFolder } = await saveItemAndMembership({ member: actor });
        await ItemTagRepository.save({
          item: publishedFolder,
          type: ItemTagType.Public,
          creator: actor,
        });
        await ItemPublishedRepository.save({ item: publishedFolder, creator: actor });
        const indexSpy = jest.spyOn(MeiliSearchWrapper.prototype, 'indexOne');
        const deleteSpy = jest.spyOn(MeiliSearchWrapper.prototype, 'deleteOne');

        const payload = {
          name: 'new name',
          extra: {
            [ItemType.DOCUMENT]: {
              content: 'updated text',
            },
          },
        };

        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `/items/${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(indexSpy).toHaveBeenCalledTimes(1);
        expect(indexSpy.mock.calls[0][0]).toMatchObject(payload);

        // Testing move usecase
        const moveDone = (id: string, dest: Item) => async () => {
          const result = await ItemRepository.findOneBy({ id: id });
          if (!result) {
            throw new Error('item does not exist!');
          }
          expect(result.path.startsWith(dest.path)).toBeTruthy();
        };
        // Move published into unpublished should be indexed
        const { item: unpublishedFolder } = await saveItemAndMembership({ member: actor });

        const move1 = await app.inject({
          method: HttpMethod.POST,
          url: `/items/move?${qs.stringify({ id: item.id }, { arrayFormat: 'repeat' })}`,
          payload: {
            parentId: unpublishedFolder.id,
          },
        });

        expect(move1.statusCode).toBe(StatusCodes.ACCEPTED);
        await waitForExpect(moveDone(item.id, unpublishedFolder), 300);
        expect(indexSpy).toHaveBeenCalledTimes(2);
        // Path update is sent to index
        expect(indexSpy.mock.calls[1][0].id).toEqual(item.id);
        expect(indexSpy.mock.calls[1][0].path.startsWith(unpublishedFolder.path)).toBeTruthy();

        // Move published into published folder should be indexed
        const move2 = await app.inject({
          method: HttpMethod.POST,
          url: `/items/move?${qs.stringify({ id: item.id }, { arrayFormat: 'repeat' })}`,
          payload: {
            parentId: publishedFolder.id,
          },
        });

        expect(move2.statusCode).toBe(StatusCodes.ACCEPTED);
        //wait for expect moved
        await waitForExpect(moveDone(item.id, publishedFolder), 300);
        expect(indexSpy).toHaveBeenCalledTimes(3);
        // Closest published at destination is reindexed
        expect(indexSpy.mock.calls[2][0].id).toEqual(item.id);

        // Move unpublished into published folder should be indexed
        const { item: unpublishedItem } = await saveItemAndMembership({
          member: actor,
          item: getDummyItem({ name: 'unpublishedItem' }),
        });
        const move3 = await app.inject({
          method: HttpMethod.POST,
          url: `/items/move?${qs.stringify({ id: unpublishedItem.id }, { arrayFormat: 'repeat' })}`,
          payload: {
            parentId: publishedFolder.id,
          },
        });

        expect(move3.statusCode).toBe(StatusCodes.ACCEPTED);
        await waitForExpect(moveDone(unpublishedItem.id, publishedFolder), 300);
        expect(indexSpy).toHaveBeenCalledTimes(4);
        // Topmost published at destination is reindexed
        expect(indexSpy.mock.calls[3][0].id).toEqual(publishedFolder.id);
        // Move unpublished nested inside published into unpublished should be deleted from index
        const move4 = await app.inject({
          method: HttpMethod.POST,
          url: `/items/move?${qs.stringify({ id: unpublishedItem.id }, { arrayFormat: 'repeat' })}`,
          payload: {
            parentId: unpublishedFolder.id,
          },
        });

        expect(move4.statusCode).toBe(StatusCodes.ACCEPTED);
        await waitForExpect(moveDone(unpublishedItem.id, unpublishedFolder), 300);
        expect(deleteSpy).toHaveBeenCalledTimes(1);
        // item is deleted from index
        expect(deleteSpy.mock.calls[0][0].id).toEqual(unpublishedItem.id);

        // Testing copy usecase
        const initialCount = await ItemRepository.count();
        const copy = await app.inject({
          method: HttpMethod.POST,
          url: `/items/copy?${qs.stringify({ id: unpublishedItem.id }, { arrayFormat: 'repeat' })}`,
          payload: {
            parentId: publishedFolder.id,
          },
        });

        expect(copy.statusCode).toBe(StatusCodes.ACCEPTED);

        await waitForExpect(async () => {
          const newCount = await ItemRepository.count();
          expect(newCount).toEqual(initialCount + 1);
        }, 300);

        expect(indexSpy).toHaveBeenCalledTimes(5);
        // Topmost published at destination is reindexed
        expect(indexSpy.mock.calls[4][0].id).not.toEqual(unpublishedItem.id);
        expect(indexSpy.mock.calls[4][0].name).toEqual('unpublishedItem');

        // Testing category usecase
        const { item: categoryItem } = await saveItemAndMembership({
          member: actor,
          parentItem: publishedFolder,
        });

        // adding category to unpublished item inside published folder will update index
        const category = await CategoryRepository.save({
          name: 'level-1',
          type: CategoryType.Level,
        });

        const categoryCall = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${categoryItem.id}/categories`,
          payload: {
            categoryId: category.id,
          },
        });
        expect(categoryCall.statusCode).toBe(StatusCodes.OK);

        expect(indexSpy).toHaveBeenCalledTimes(6);
        expect(indexSpy.mock.calls[5][0].id).toEqual(publishedFolder.id);

        // deleting category also update index
        const deleteCategoryCall = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/${categoryItem.id}/categories/${categoryCall.json().id}`,
        });

        expect(deleteCategoryCall.statusCode).toBe(StatusCodes.OK);

        expect(indexSpy).toHaveBeenCalledTimes(7);
        expect(indexSpy.mock.calls[6][0].id).toEqual(publishedFolder.id);
      });
    });
  });
});
