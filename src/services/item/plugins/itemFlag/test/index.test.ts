import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { FlagType, HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { ItemNotFound } from '../../../../../utils/errors';
import { saveMember } from '../../../../member/test/fixtures/members';
import { ItemTestUtils } from '../../../test/fixtures/items';
import { ItemFlagRepository } from '../repository';

// mock datasource
jest.mock('../../../../../plugins/datasource');
const testUtils = new ItemTestUtils();

const expectItemFlag = (flag, correctFlag) => {
  expect(flag.id).toEqual(correctFlag.id);
  expect(flag.flagType).toEqual(correctFlag.flagType);
  expect(flag.creator.id).toEqual(correctFlag.creator.id);
  expect(flag.item.id).toEqual(correctFlag.item.id);
};

describe('Item Flag Tests', () => {
  let app;
  let actor;
  const payload = { type: FlagType.FalseInformation };

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('GET /flags', () => {
    it('Successfully get flags', async () => {
      ({ app } = await build({ member: null }));
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/flags`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(await response.json()).toEqual(Object.values(FlagType));
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Successfully get flags', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/flags`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(await response.json()).toEqual(Object.values(FlagType));
      });
    });
  });

  describe('POST /:itemId/flags', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/flags`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });
      it('Successfully post item flag', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member: actor });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/flags`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const [flagContent] = await ItemFlagRepository.find({
          relations: { creator: true, item: true },
        });
        expect(flagContent.type).toEqual(payload.type);
        expectItemFlag(await response.json(), flagContent);
      });

      it('Bad request if item id is not valid', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/flags`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item is not found', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/flags`,
          payload,
        });

        expect(response.json()).toMatchObject(new ItemNotFound(expect.anything()));
      });

      it('Bad request if payload is not valid', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member: actor });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/flags`,
          payload: { flagType: 'invalid-type' },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
