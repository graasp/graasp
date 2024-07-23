import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../../test/app';
import { notUndefined } from '../../../../../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../../../../../utils/config';
import { Actor, Member } from '../../../../../member/entities/member';
import { saveMember } from '../../../../../member/test/fixtures/members';
import { ItemTestUtils } from '../../../../test/fixtures/items';

const testUtils = new ItemTestUtils();

// mock datasource
// jest.mock('../../../../../../plugins/datasource');

describe('Publication Controller', () => {
  let app: FastifyInstance;
  let actor: Actor | undefined;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = undefined;
    app.close();
  });

  describe('GET /publication', () => {
    describe('Signed Out', () => {
      let member: Member;

      beforeEach(async () => {
        ({ app } = await build({ member: null }));
        member = await saveMember();
      });

      it('Get publication status item returns unauthorized', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member });
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/publication/${item.id}/status`,
        });
        expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Authenticated Member', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Get publication status of item without permission returns forbidden', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member });
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/publication/${item.id}/status`,
        });
        expect(res.statusCode).toBe(StatusCodes.FORBIDDEN);
      });

      it('Get publication status of item with permission returns status', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member: notUndefined(actor) });
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/publication/${item.id}/status`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.body).not.toBeUndefined;
      });

      it('Get publication status of invalid item returns 404', async () => {
        const invalidId = v4();
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/publication/${invalidId}/status`,
        });
        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
      });
    });
  });
});
