import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';
import waitForExpect from 'wait-for-expect';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemValidationStatus, PermissionLevel, PublicationStatus } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../../test/app';
import { Item } from '../../../../../../drizzle/types';
import { ITEMS_ROUTE_PREFIX } from '../../../../../../utils/config';
import { ItemNotFound, MemberCannotAdminItem } from '../../../../../../utils/errors';
import { saveMember } from '../../../../../member/test/fixtures/members';
import { ItemTestUtils } from '../../../../test/fixtures/items';
import { ItemValidationGroupNotFound } from '../errors';
import { ItemModeratorValidate, saveItemValidation, stubItemModerator } from './utils';

const VALIDATION_LOADING_TIME = 2000;

const testUtils = new ItemTestUtils();
const itemValidationGroupRawRepository = AppDataSource.getRepository(ItemValidationGroup);

const fetchStatus = async (app, itemId: string) =>
  await app.inject({
    method: HttpMethod.Get,
    url: `${ITEMS_ROUTE_PREFIX}/publication/${itemId}/status`,
  });

const expectItemValidation = (iv, correctIV) => {
  expect(iv.id).toEqual(correctIV.id);
  expect(iv.item.id).toEqual(correctIV.item.id);
  expect(iv.itemValidations).toHaveLength(correctIV.itemValidations.length);
};

describe('Item Validation Tests', () => {
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
    actor = null;
    unmockAuthenticate();
  });

  describe('GET /:itemId/validations/latest', () => {
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validations/latest`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Get latest item validation', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const { itemValidationGroup } = await saveItemValidation({ item });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/latest`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectItemValidation(res.json(), itemValidationGroup);
      });

      it('Throws if has read permission', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Read,
        });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/latest`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Throws if has write permission', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Write,
        });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/latest`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));

        // check no created entries
      });

      it('Bad request if id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/invalid/validations/latest`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validations/latest`,
        });
        expect(res.json()).toMatchObject(new ItemNotFound(expect.anything()));
      });
    });
  });

  describe('GET /:itemId/validations/:itemValidationGroupId', () => {
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validations/${v4()}`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Get item validation groups', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        const { itemValidationGroup } = await saveItemValidation({ item });
        // save another item validation
        await saveItemValidation({ item });
        const res = await app.inject({
          method: HttpMethod.Get,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/${itemValidationGroup!.id}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectItemValidation(res.json(), itemValidationGroup);
      });

      it('Throws if has read permission', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Read,
        });
        const { itemValidationGroup } = await saveItemValidation({ item });

        const res = await app.inject({
          method: HttpMethod.Get,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/${itemValidationGroup!.id}`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Throws if has write permission', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Write,
        });
        const { itemValidationGroup } = await saveItemValidation({ item });

        const res = await app.inject({
          method: HttpMethod.Get,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/${itemValidationGroup!.id}`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Bad request if id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/validations/${v4()}`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validations/${v4()}`,
        });
        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
      });

      it('Bad request if group id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validations/invalid-id`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if validation group does not exist', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member: actor });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/${v4()}`,
        });
        expect(res.json()).toMatchObject(new ItemValidationGroupNotFound(expect.anything()));
      });
    });
  });

  describe('POST /:itemId/validate', () => {
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validate`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });
      it('create validation', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        await saveItemValidation({ item });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validate`,
        });
        expect(res.statusCode).toBe(StatusCodes.ACCEPTED);
        expect(res.body).toEqual(item.id);

        await waitForExpect(async () => {
          // previous and newly created validation group
          expect(await itemValidationGroupRawRepository.countBy({ item })).toEqual(2);
        });

        // valid item should be published automatically
        const publishedRes = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/informations`,
        });
        expect(publishedRes.statusCode).toBe(StatusCodes.OK);
        expect(publishedRes.json()?.item.id).toBe(item.id);
      });

      it('Status is pending for item and children when validation is not done', async () => {
        const { item } = await testUtils.saveItemAndMembership({
          item: { updatedAt: new Date() },
          member: actor,
        });
        const { item: child } = await testUtils.saveItemAndMembership({
          item: { updatedAt: new Date() },
          member: actor,
          parentItem: item,
        });

        // stub the item moderator
        const stubValidate: ItemModeratorValidate = async (
          _repositories,
          itemToValidate: Item,
          _itemValidationGroup,
        ) => {
          const isChildItem = itemToValidate.id === child.id;
          const timeout = isChildItem ? 500 : 0;
          // sleep to let the time to check pending status in the test
          await new Promise((resolve) => setTimeout(resolve, timeout));
          return [ItemValidationStatus.Success];
        };
        stubItemModerator(stubValidate);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validate`,
        });
        expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

        // return valid status for validation
        await waitForExpect(async () => {
          const resStatus = [await fetchStatus(app, item.id), await fetchStatus(app, child.id)];
          expect([ItemValidationStatus.Pending, PublicationStatus.Published]).toContain(
            resStatus[0].body,
          );
          expect([ItemValidationStatus.Pending, PublicationStatus.PublishedChildren]).toContain(
            resStatus[1].body,
          );
        });
      });

      it('Throws if has read permission', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Read,
        });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validate`,
        });
        expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

        // wait for validation to happen before checking nothing was created
        await new Promise((res) => {
          setTimeout(async () => {
            // check no created entries
            expect(await itemValidationGroupRawRepository.countBy({ item })).toEqual(0);
            res(true);
          }, VALIDATION_LOADING_TIME);
        });
      });

      it('Throws if has write permission', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Write,
        });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validate`,
        });
        expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

        // wait for validation to happen before checking nothing was created
        await new Promise((res) => {
          setTimeout(async () => {
            // check no created entries
            expect(await itemValidationGroupRawRepository.countBy({ item })).toEqual(0);
            res(true);
          }, VALIDATION_LOADING_TIME);
        });
      });

      it('Bad request if id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/validate`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const { item } = await testUtils.saveItemAndMembership({
          member: actor,
        });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validate`,
        });
        expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

        // wait for validation to happen before checking nothing was created
        await new Promise((res) => {
          setTimeout(async () => {
            // check no created entries
            expect(await itemValidationGroupRawRepository.countBy({ item })).toEqual(0);
            res(true);
          }, VALIDATION_LOADING_TIME);
        });
      });
    });
  });
});
