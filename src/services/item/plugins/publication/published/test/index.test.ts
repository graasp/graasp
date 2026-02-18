import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';
import waitForExpect from 'wait-for-expect';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType, ItemVisibilityType, PermissionLevel } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../../test/app';
import { resolveDependency } from '../../../../../../di/utils';
import { AppDataSource } from '../../../../../../plugins/datasource';
import { MailerService } from '../../../../../../plugins/mailer/service';
import { ITEMS_ROUTE_PREFIX } from '../../../../../../utils/config';
import { ItemNotFound, MemberCannotAdminItem } from '../../../../../../utils/errors';
import { saveMember, saveMembers } from '../../../../../member/test/fixtures/members';
import { Item } from '../../../../entities/Item';
import {
  ItemTestUtils,
  expectItem,
  expectManyItems,
  expectManyPackedItems,
} from '../../../../test/fixtures/items';
import { ItemLike } from '../../../itemLike/itemLike';
import { saveItemLikes } from '../../../itemLike/test/utils';
import { ItemVisibility } from '../../../itemVisibility/ItemVisibility';
import { ItemVisibilityNotFound } from '../../../itemVisibility/errors';
import { saveItemValidation } from '../../validation/test/utils';
import { ItemPublished } from '../entities/itemPublished';
import { ItemPublishedNotFound } from '../errors';
import { ItemPublishedRepository } from '../repositories/itemPublished';

const testUtils = new ItemTestUtils();

const rawRepository = AppDataSource.getRepository(ItemVisibility);

const expectPublishedEntry = (value, expectedValue) => {
  expect(value.item.id).toEqual(expectedValue.item.id);
  expect(value.creator.id).toEqual(expectedValue.creator.id);
};

describe('Item Published', () => {
  let app: FastifyInstance;
  let actor;
  const itemPublishedRawRepository = AppDataSource.getRepository(ItemPublished);

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    actor = null;
    unmockAuthenticate();
  });

  describe('GET /collections', () => {
    describe('Signed Out', () => {
      let member;

      beforeEach(async () => {
        member = await saveMember();
      });

      it('Get publish info of child item returns root published item', async () => {
        const { item: parentItem } = await testUtils.saveItemAndMembership({ member });
        const { item } = await testUtils.saveItemAndMembership({ member, parentItem });
        await testUtils.itemVisibilityRepository.post(
          member,
          parentItem,
          ItemVisibilityType.Public,
        );
        // publish parent
        await itemPublishedRawRepository.save({ item: parentItem, creator: member });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/informations`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectItem(res.json()?.item, parentItem);
      });
      it('Get publish info of multiple childs returns root published items', async () => {
        const { item: parentItem } = await testUtils.saveItemAndMembership({ member });
        const { item: otherParentItem } = await testUtils.saveItemAndMembership({ member });
        const { item } = await testUtils.saveItemAndMembership({ member, parentItem });
        await testUtils.itemVisibilityRepository.post(
          member,
          parentItem,
          ItemVisibilityType.Public,
        );
        await testUtils.itemVisibilityRepository.post(
          member,
          otherParentItem,
          ItemVisibilityType.Public,
        );

        // publish parents
        await itemPublishedRawRepository.save({ item: parentItem, creator: member });
        await itemPublishedRawRepository.save({ item: otherParentItem, creator: member });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/collections/informations`,
          query: { itemId: [item.id, otherParentItem.id] },
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        const result = (await res.json().data) as { [key: string]: ItemPublished };
        const items = Object.values(result).map((i) => i.item);
        expectManyItems(items as Item[], [otherParentItem, parentItem]);
      });
      it('Get publish info of non public item returns forbidden', async () => {
        // simple item not public and not published
        const { item } = await testUtils.saveItemAndMembership({ member });
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/informations`,
        });
        expect(res.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
      it('Get publish info of public item that is not published yet returns null', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member });
        // make item public
        await testUtils.itemVisibilityRepository.post(member, item, ItemVisibilityType.Public);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/informations`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toBe(null);
      });
      it('Throw if category id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/collections`,
          query: { categoryId: 'invalid-id' },
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
        member = await saveMember();
        ({ items: collections } = await testUtils.saveCollections(member));
      });

      it('Get 2 most recent collections', async () => {
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/collections/recent`,
          query: { limit: '2' },
        });
        expect(res.statusCode).toBe(StatusCodes.OK);

        expect(res.json()).toHaveLength(2);
      });

      it('Get recent published collections without hidden', async () => {
        const hiddenCollection = collections[0];
        await rawRepository.save({
          item: hiddenCollection,
          creator: actor,
          type: ItemVisibilityType.Hidden,
        });
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/collections/recent`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json().map(({ id }) => id)).not.toContain(hiddenCollection.id);
      });
    });
  });

  describe('GET /collections/liked', () => {
    describe('Signed Out', () => {
      let members;
      let collections: Item[];
      const likes: ItemLike[] = [];

      beforeEach(async () => {
        members = await saveMembers();
        ({ items: collections } = await testUtils.saveCollections(members[0]));

        // add idx x likes
        for (const [idx, c] of collections.entries()) {
          for (const m of members.slice(idx)) {
            likes.concat(await saveItemLikes([c], m));
          }
        }
      });

      it('Get 2 most liked collections', async () => {
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/collections/liked`,
          query: { limit: '2' },
        });

        const result = collections.slice(0, -1);

        expect(res.statusCode).toBe(StatusCodes.OK);
        expectManyItems(res.json(), result);
      });

      it('Get 2 most liked collections without hidden', async () => {
        // hide first collection
        const hiddenCollection = collections[0];
        await rawRepository.save({
          item: hiddenCollection,
          creator: actor,
          type: ItemVisibilityType.Hidden,
        });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/collections/liked`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json().map(({ id }) => id)).not.toContain(hiddenCollection.id);
      });
    });
  });

  describe('GET /collections/members/:memberId', () => {
    describe('Signed Out', () => {
      it('Returns published collections for member', async () => {
        const member = await saveMember();
        const { packedItems: items, visibilities } = await testUtils.saveCollections(member);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/collections/members/${member.id}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectManyPackedItems(res.json(), items, undefined, undefined, visibilities);
      });
    });

    describe('Signed In', () => {
      let actor;

      beforeEach(async () => {
        ({ app, actor } = await build());
        await testUtils.saveCollections(actor);
      });

      it('Get published collections for member', async () => {
        // add other collections
        const member = await saveMember();
        const { packedItems: items, visibilities } = await testUtils.saveCollections(member);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/collections/members/${member.id}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectManyPackedItems(res.json(), items, member, undefined, visibilities);
      });
    });
  });

  describe('POST /collections/:itemId/publish', () => {
    describe('Signed Out', () => {
      it('Throw if signed out', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed In', () => {
      let actor;

      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Publish item with admin rights', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          // We have to define dates, otherwise it will be random dates.
          item: {
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          creator: member,
          member: actor,
          permission: PermissionLevel.Admin,
        });
        await rawRepository.save({ item, type: ItemVisibilityType.Public, creator: member });
        // should validate before publishing
        await saveItemValidation({ item });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectPublishedEntry(res.json(), { item, creator: actor });
      });

      it('Publish item with admin rights and send notification', async () => {
        const mailerService = resolveDependency(MailerService);
        const sendEmailMock = jest.spyOn(mailerService, 'sendRaw');

        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          // We have to define dates, otherwise it will be random dates.
          item: {
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          creator: member,
          member: actor,
          permission: PermissionLevel.Admin,
        });
        const anna = await saveMember();
        await testUtils.saveMembership({
          item,
          account: anna,
          permission: PermissionLevel.Admin,
        });
        const cedric = await saveMember();
        await testUtils.saveMembership({
          item,
          account: cedric,
          permission: PermissionLevel.Admin,
        });
        await rawRepository.save({ item, type: ItemVisibilityType.Public, creator: member });
        // should validate before publishing
        await saveItemValidation({ item });

        const res = await app.inject({
          method: HttpMethod.Post,
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
            expect.anything(),
            expect.anything(),
          );
          expect(sendEmailMock).toHaveBeenCalledWith(
            expect.stringContaining(item.name),
            cedric.email,
            expect.stringContaining(item.id),
            expect.anything(),
            expect.anything(),
            expect.anything(),
          );
        }, 1000);
      });

      it('Cannot publish private item', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          // We have to define dates, otherwise it will be random dates.
          item: {
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          creator: member,
          member: actor,
          permission: PermissionLevel.Admin,
        });
        // should validate before publishing
        await saveItemValidation({ item });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
        expect(res.json()).toMatchObject(new ItemVisibilityNotFound(expect.anything()));
      });

      it('Cannot publish item with write rights', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Write,
        });
        await rawRepository.save({ item, type: ItemVisibilityType.Public, creator: member });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Cannot publish item with read rights', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Read,
        });
        await rawRepository.save({ item, type: ItemVisibilityType.Public, creator: member });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Cannot publish non-folder item', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          item: {
            type: ItemType.APP,
          },
          creator: member,
          member: actor,
          permission: PermissionLevel.Admin,
        });
        await rawRepository.save({ item, type: ItemVisibilityType.Public, creator: member });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Cannot publish item without validating it first', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          item: {
            type: ItemType.FOLDER,
          },
          creator: member,
          member: actor,
          permission: PermissionLevel.Admin,
        });
        await rawRepository.save({ item, type: ItemVisibilityType.Public, creator: member });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/invalid-id/publish`,
        });
        expect(res.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item is not found', async () => {
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${v4()}/publish`,
        });
        expect(res.json()).toMatchObject(new ItemNotFound(expect.anything()));
      });
    });
  });

  describe('DELETE /collections/:itemId/unpublish', () => {
    describe('Signed Out', () => {
      it('Throw if signed out', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member });

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/unpublish`,
        });
        expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed In', () => {
      let actor;

      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Unpublish item with admin rights', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Admin,
        });
        await rawRepository.save({ item, type: ItemVisibilityType.Public, creator: member });
        await new ItemPublishedRepository().post(member, item);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/unpublish`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectPublishedEntry(res.json(), { item, creator: member });
      });

      it('Throws when unpublish non-published item', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Admin,
        });
        await rawRepository.save({ item, type: ItemVisibilityType.Public, creator: member });

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/unpublish`,
        });
        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
        expect(res.json()).toMatchObject(new ItemPublishedNotFound(expect.anything()));
      });

      it('Cannot publish item with write rights', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Write,
        });
        await rawRepository.save({ item, type: ItemVisibilityType.Public, creator: member });
        await new ItemPublishedRepository().post(member, item);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/unpublish`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Cannot publish item with read rights', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Read,
        });
        await rawRepository.save({ item, type: ItemVisibilityType.Public, creator: member });
        await new ItemPublishedRepository().post(member, item);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/unpublish`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Throws if item id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/collections/invalid-id/unpublish`,
        });
        expect(res.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item is not found', async () => {
        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${v4()}/unpublish`,
        });
        expect(res.json()).toMatchObject(new ItemNotFound(expect.anything()));
      });
    });
  });
});
