import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import type { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate } from '../../../../../../test/app';
import { seedFromJson } from '../../../../../../test/mocks/seed';
import { db } from '../../../../../drizzle/db';
import { assertIsDefined } from '../../../../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';

describe('Publication Controller', () => {
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
  });

  describe('GET /publication', () => {
    describe('Signed Out', () => {
      it('Get publication status item returns unauthorized', async () => {
        const {
          items: [item],
        } = await seedFromJson({ actor: null, items: [{}] });
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/publication/${item.id}/status`,
        });
        expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Authenticated Member', () => {
      it('Get publication status of item without permission returns forbidden', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({ items: [{}] });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/publication/${item.id}/status`,
        });
        expect(res.statusCode).toBe(StatusCodes.FORBIDDEN);
      });

      it('Get publication status of item with permission returns status', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: 'admin' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/publication/${item.id}/status`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.body).not.toBeUndefined();
      });

      it('Get publication status of invalid item returns 404', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

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
