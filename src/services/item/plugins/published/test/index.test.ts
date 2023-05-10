import { StatusCodes } from 'http-status-codes';
import qs from 'qs';
import { v4 } from 'uuid';

import { HttpMethod, ItemTagType, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { ItemNotFound, MemberCannotAdminItem } from '../../../../../utils/errors';
import { saveItemAndMembership } from '../../../../itemMembership/test/fixtures/memberships';
import { BOB, saveMember } from '../../../../member/test/fixtures/members';
import { Item } from '../../../entities/Item';
import { expectManyItems } from '../../../test/fixtures/items';
import { ItemCategoryRepository } from '../../itemCategory/repositories/itemCategory';
import { saveCategories } from '../../itemCategory/test/index.test';
import { ItemTagNotFound } from '../../itemTag/errors';
import { ItemTagRepository } from '../../itemTag/repository';
import { ItemPublishedNotFound } from '../errors';
import { ItemPublishedRepository } from '../repositories/itemPublished';

// mock datasource
jest.mock('../../../../../plugins/datasource');

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
      it('Get all published collections without hidden', async () => {
        const hiddenCollection = collections[0];
        await ItemTagRepository.save({
          item: hiddenCollection,
          creator: actor,
          type: ItemTagType.HIDDEN,
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

  describe('POST /collections/itemId/publish', () => {
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
        await ItemTagRepository.save({ item, type: ItemTagType.PUBLIC, creator: member });

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectPublishedEntry(res.json(), { item, creator: actor });
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
        await ItemTagRepository.save({ item, type: ItemTagType.PUBLIC, creator: member });

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
        await ItemTagRepository.save({ item, type: ItemTagType.PUBLIC, creator: member });

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

  describe('DELETE /collections/itemId/unpublish', () => {
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
        await ItemTagRepository.save({ item, type: ItemTagType.PUBLIC, creator: member });
        await ItemPublishedRepository.save({ item, creator: member });

        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/unpublish`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectPublishedEntry(res.json(), { item, creator: member });
      });

      it('Throws when unpublish non-published item', async () => {
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Admin,
        });
        await ItemTagRepository.save({ item, type: ItemTagType.PUBLIC, creator: member });

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
        await ItemTagRepository.save({ item, type: ItemTagType.PUBLIC, creator: member });
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
        await ItemTagRepository.save({ item, type: ItemTagType.PUBLIC, creator: member });
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
});
