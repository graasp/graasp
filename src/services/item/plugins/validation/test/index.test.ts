import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { ItemNotFound, MemberCannotAdminItem } from '../../../../../utils/errors';
import { saveItemAndMembership } from '../../../../itemMembership/test/fixtures/memberships';
import { BOB, saveMember } from '../../../../member/test/fixtures/members';
import { ItemValidationGroupNotFound } from '../errors';
import { ItemValidationGroupRepository } from '../repositories/ItemValidationGroup';
import { saveItemValidation } from './utils';

const VALIDATION_LOADING_TIME = 2000;

// mock datasource
jest.mock('../../../../../plugins/datasource');

const expectItemValidation = (iv, correctIV) => {
  expect(iv.id).toEqual(correctIV.id);
  expect(iv.item.id).toEqual(correctIV.item.id);
  expect(iv.itemValidations).toHaveLength(correctIV.itemValidations.length);
};

describe('Item Validation Tests', () => {
  let app;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('GET /:itemId/validations/latest', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const response = await app.inject({
        method: HttpMethod.GET,
        url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validations/latest`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Get latest item validation', async () => {
        const { item } = await saveItemAndMembership({ member: actor });
        const { itemValidationGroup } = await saveItemValidation({ item });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/latest`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectItemValidation(res.json(), itemValidationGroup);
      });

      it('Throws if has read permission', async () => {
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Read,
        });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/latest`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));

        // check no created entries
      });

      it('Throws if has write permission', async () => {
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Write,
        });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/latest`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));

        // check no created entries
      });

      it('Bad request if id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/invalid/validations/latest`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validations/latest`,
        });
        expect(res.json()).toMatchObject(new ItemNotFound(expect.anything()));
      });
    });
  });

  describe('GET /:itemId/validations/:itemValidationGroupId', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const response = await app.inject({
        method: HttpMethod.GET,
        url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validations/${v4()}`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Get item validation groups', async () => {
        const { item } = await saveItemAndMembership({ member: actor });
        const { itemValidationGroup } = await saveItemValidation({ item });
        // save another item validation
        await saveItemValidation({ item });
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/${itemValidationGroup!.id}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectItemValidation(res.json(), itemValidationGroup);
      });

      it('Throws if has read permission', async () => {
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Read,
        });
        const { itemValidationGroup } = await saveItemValidation({ item });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/${itemValidationGroup!.id}`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Throws if has write permission', async () => {
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Write,
        });
        const { itemValidationGroup } = await saveItemValidation({ item });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/${itemValidationGroup!.id}`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Bad request if id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/validations/${v4()}`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validations/${v4()}`,
        });
        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
      });

      it('Bad request if group id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validations/invalid-id`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if validation group does not exist', async () => {
        const { item } = await saveItemAndMembership({ member: actor });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/${v4()}`,
        });
        expect(res.json()).toMatchObject(new ItemValidationGroupNotFound(expect.anything()));
      });
    });
  });

  describe('POST /:itemId/validate', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validate`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });
      it('create validation', async () => {
        const { item } = await saveItemAndMembership({ member: actor });
        await saveItemValidation({ item });
        const count = await ItemValidationGroupRepository.find();

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validate`,
        });
        expect(res.statusCode).toBe(StatusCodes.ACCEPTED);
        expect(res.body).toEqual(item.id);

        await new Promise((res) => {
          setTimeout(async () => {
            // check no created entries
            expect(count).toHaveLength((await ItemValidationGroupRepository.find()).length - 1);
            res(true);
          }, VALIDATION_LOADING_TIME);
        });
      });

      it('Throws if has read permission', async () => {
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Read,
        });
        await saveItemValidation({ item });
        const count = await ItemValidationGroupRepository.find();

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validate`,
        });
        expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

        await new Promise((res) => {
          setTimeout(async () => {
            // check no created entries
            expect(count).toHaveLength((await ItemValidationGroupRepository.find()).length);
            res(true);
          }, VALIDATION_LOADING_TIME);
        });
      });

      it('Throws if has write permission', async () => {
        const member = await saveMember(BOB);
        const { item } = await saveItemAndMembership({
          creator: member,
          member: actor,
          permission: PermissionLevel.Write,
        });
        await saveItemValidation({ item });
        const count = await ItemValidationGroupRepository.find();

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validate`,
        });
        expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

        await new Promise((res) => {
          setTimeout(async () => {
            // check no created entries
            expect(count).toHaveLength((await ItemValidationGroupRepository.find()).length);
            res(true);
          }, VALIDATION_LOADING_TIME);
        });
      });

      it('Bad request if id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/validate`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const { item } = await saveItemAndMembership({
          member: actor,
        });
        await saveItemValidation({ item });
        const count = await ItemValidationGroupRepository.find();

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validate`,
        });
        expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

        await new Promise((res) => {
          setTimeout(async () => {
            // check no created entries
            expect(count).toHaveLength((await ItemValidationGroupRepository.find()).length);
            res(true);
          }, VALIDATION_LOADING_TIME);
        });
      });
    });
  });
});
