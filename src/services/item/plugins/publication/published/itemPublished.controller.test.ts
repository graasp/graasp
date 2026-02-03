import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';
import waitForExpect from 'wait-for-expect';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, ItemValidationStatus } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../test/app';
import { seedFromJson } from '../../../../../../test/mocks/seed';
import { resolveDependency } from '../../../../../di/utils';
import { db } from '../../../../../drizzle/db';
import { publishedItemsTable } from '../../../../../drizzle/schema';
import { MailerService } from '../../../../../plugins/mailer/mailer.service';
import { assertIsDefined } from '../../../../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { MemberCannotAdminItem } from '../../../../../utils/errors';
import { ItemWrapper } from '../../../ItemWrapper';
import { expectItem, expectManyPackedItems } from '../../../test/fixtures/items';
import { ItemVisibilityNotFound } from '../../itemVisibility/errors';
import { MeiliSearchWrapper } from './plugins/search/meilisearch';

jest.mock('./plugins/search/meilisearch');

describe('Item Published', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('GET /collections', () => {
    describe('Signed Out', () => {
      it('Get publish info of child item returns root published item', async () => {
        const {
          items: [parentItem, item],
        } = await seedFromJson({
          items: [{ isPublic: true, isPublished: true, children: [{}] }],
        });

        // const { item: parentItem } = await testUtils.saveItemAndMembership({ member });
        // const { item } = await testUtils.saveItemAndMembership({ member, parentItem });
        // await testUtils.itemVisibilityRepository.post(
        //   app.db,
        //   member,
        //   parentItem,
        //   ItemVisibilityType.Public,
        // );
        // // publish parent
        // await itemPublishedRawRepository.save({ item: parentItem, creator: member });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/informations`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectItem(res.json()?.item, parentItem);
      });
      // REMOVE - don't use get many published info
      // it('Get publish info of multiple childs returns root published items', async () => {

      //   const {
      //     items: [parentItem, item],
      //   } = await seedFromJson({
      //     items: [{ isPublic: true, isPublished: true, children: [{ isPublic: true }] }],
      //   });

      // const { item: parentItem } = await testUtils.saveItemAndMembership({ member });
      // const { item: otherParentItem } = await testUtils.saveItemAndMembership({ member });
      // const { item } = await testUtils.saveItemAndMembership({ member, parentItem });
      // await testUtils.itemVisibilityRepository.post(
      //   app.db,
      //   member,
      //   parentItem,
      //   ItemVisibilityType.Public,
      // );
      // await testUtils.itemVisibilityRepository.post(
      //   app.db,
      //   member,
      //   otherParentItem,
      //   ItemVisibilityType.Public,
      // );

      // // publish parents
      // await itemPublishedRawRepository.save({ item: parentItem, creator: member });
      // await itemPublishedRawRepository.save({ item: otherParentItem, creator: member });

      //   const res = await app.inject({
      //     method: HttpMethod.Get,
      //     url: `${ITEMS_ROUTE_PREFIX}/collections/informations`,
      //     query: { itemId: [item.id, otherParentItem.id] },
      //   });
      //   expect(res.statusCode).toBe(StatusCodes.OK);
      //   const result = (await res.json().data) as { [key: string]: ItemPublishedRaw };
      //   const items = Object.values(result).map((i) => i.item);
      //   expectManyItems(items as Item[], [otherParentItem, parentItem]);
      // });
      it('Get publish info of non public item returns forbidden', async () => {
        // simple item not public and not published
        const {
          items: [item],
        } = await seedFromJson({ items: [{}] });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/informations`,
        });
        expect(res.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
      it('Get publish info of public item that is not published yet returns null', async () => {
        const {
          items: [item],
        } = await seedFromJson({ items: [{ isPublic: true }] });

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

  describe('GET /collections/members/:memberId', () => {
    describe('Signed Out', () => {
      it('Returns published collections for member', async () => {
        const {
          items,
          itemVisibilities,
          members: [member],
        } = await seedFromJson({
          items: [
            {
              isPublic: true,
              isPublished: true,
              creator: { name: 'bob' },
              memberships: [{ account: { name: 'bob' }, permission: 'admin' }],
            },
            {
              isPublic: true,
              isPublished: true,
              creator: { name: 'bob' },
              memberships: [{ account: { name: 'bob' }, permission: 'admin' }],
            },
            {
              isPublic: true,
              isPublished: true,
              creator: { name: 'bob' },
              memberships: [{ account: { name: 'bob' }, permission: 'admin' }],
            },
          ],
        });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/collections/members/${member.id}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectManyPackedItems(
          res.json(),
          items.map((i) =>
            new ItemWrapper({ ...i, creator: member }, { permission: 'admin' }).packed(),
          ),
          undefined,
          undefined,
          itemVisibilities,
        );
      });
    });

    describe('Signed In', () => {
      it('Get published collections for member', async () => {
        const {
          actor,
          items,
          members: [member],
          itemVisibilities,
        } = await seedFromJson({
          items: [
            {
              isPublished: true,
              isPublic: true,
              creator: { name: 'bob' },
              memberships: [{ account: { name: 'bob' }, permission: 'admin' }],
            },
            {
              isPublished: true,
              isPublic: true,
              creator: { name: 'bob' },
              memberships: [{ account: { name: 'bob' }, permission: 'admin' }],
            },
            {
              isPublished: true,
              isPublic: true,
              creator: { name: 'bob' },
              memberships: [{ account: { name: 'bob' }, permission: 'admin' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/collections/members/${member.id}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectManyPackedItems(
          res.json(),
          items.map((i) =>
            new ItemWrapper({ ...i, creator: member }, { permission: 'admin' }).packed(),
          ),
          member,
          undefined,
          itemVisibilities,
        );
      });
    });
  });

  describe('POST /collections/:itemId/publish', () => {
    describe('Signed Out', () => {
      it('Throw if signed out', async () => {
        const {
          items: [item],
        } = await seedFromJson({
          actor: null,
          items: [{ isPublished: true, isPublic: true, creator: { name: 'bob' } }],
        });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed In', () => {
      it('Publish item with admin rights', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              isPublic: true,
              itemValidations: [{ groupName: 'group', status: ItemValidationStatus.Success }],
              memberships: [{ account: 'actor', permission: 'admin' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const indexSpy = jest.spyOn(MeiliSearchWrapper.prototype, 'indexOne');

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);

        // item is published
        expect(
          await db.query.publishedItemsTable.findFirst({
            where: eq(publishedItemsTable.itemPath, item.path),
          }),
        ).toBeDefined();
        // Publishing an item triggers an indexing
        expect(indexSpy).toHaveBeenCalledTimes(1);
        expectItem(indexSpy.mock.calls[0][1].item, item);
      });

      it('Publish item with admin rights and send notification', async () => {
        const mailerService = resolveDependency(MailerService);
        const sendEmailMock = jest.spyOn(mailerService, 'sendRaw');

        const {
          actor,
          items: [item],
          members: [anna, cedric],
        } = await seedFromJson({
          items: [
            {
              isPublic: true,
              itemValidations: [{ groupName: 'group', status: ItemValidationStatus.Success }],
              memberships: [
                { account: 'actor', permission: 'admin' },
                { account: { name: 'anna' }, permission: 'admin' },
                { account: { name: 'cedric' }, permission: 'admin' },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);

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
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              itemValidations: [{ groupName: 'group', status: ItemValidationStatus.Success }],
              memberships: [{ account: 'actor', permission: 'admin' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
        expect(res.json()).toMatchObject(new ItemVisibilityNotFound(expect.anything()));
      });

      it('Cannot publish item with write rights', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              itemValidations: [{ groupName: 'group', status: ItemValidationStatus.Success }],
              memberships: [{ account: 'actor', permission: 'write' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Cannot publish item with read rights', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              itemValidations: [{ groupName: 'group', status: ItemValidationStatus.Success }],
              memberships: [{ account: 'actor', permission: 'read' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Cannot publish non-folder item', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              type: 'document',
              itemValidations: [{ groupName: 'group', status: ItemValidationStatus.Success }],
              memberships: [{ account: 'actor', permission: 'admin' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Cannot publish item without validating it first', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/publish`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item id is invalid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/invalid-id/publish`,
        });
        expect(res.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item is not found', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${v4()}/publish`,
        });
        expect(res.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });
    });
  });

  describe('DELETE /collections/:itemId/unpublish', () => {
    describe('Signed Out', () => {
      it('Throw if signed out', async () => {
        const {
          items: [item],
        } = await seedFromJson({ actor: null, items: [{}] });

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/unpublish`,
        });
        expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });
    describe('Signed In', () => {
      it('Unpublish item with admin rights', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              isPublic: true,
              isPublished: true,
              creator: 'actor',
              memberships: [{ account: 'actor', permission: 'admin' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const indexSpy = jest.spyOn(MeiliSearchWrapper.prototype, 'deleteOne');
        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/unpublish`,
        });
        expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);

        expect(
          await db.query.publishedItemsTable.findFirst({
            where: eq(publishedItemsTable.itemPath, item.path),
          }),
        );
        expect(indexSpy).toHaveBeenCalledTimes(1);
        expectItem(indexSpy.mock.calls[0][1], item);
      });
      it('Throws when unpublish non-published item', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              isPublic: true,
              creator: 'actor',
              memberships: [{ account: 'actor', permission: 'admin' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/unpublish`,
        });
        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
      });
      it('Cannot publish item with write rights', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              isPublic: true,
              isPublished: true,
              creator: 'actor',
              memberships: [{ account: 'actor', permission: 'write' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/unpublish`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });
      it('Cannot publish item with read rights', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              isPublic: true,
              isPublished: true,
              creator: 'actor',
              memberships: [{ account: 'actor', permission: 'read' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/unpublish`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });
      it('Throws if item id is invalid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/collections/invalid-id/unpublish`,
        });
        expect(res.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });
      it('Throws if item is not found', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${v4()}/unpublish`,
        });
        expect(res.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });
    });
  });
});
