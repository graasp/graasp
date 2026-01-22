import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import type { FastifyInstance } from 'fastify';

import { FlagType, HttpMethod } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { itemFlagsTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../../../utils/config';

const payload = { type: FlagType.FalseInformation };

describe('Item Flag Tests', () => {
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

  describe('GET /flags', () => {
    it('Successfully get flags', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/flags`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(await response.json()).toEqual(Object.values(FlagType));
    });

    describe('Signed In', () => {
      it('Successfully get flags', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

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
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/flags`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Successfully post item flag', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: 'read' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/flags`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
        const flagContent = await db.query.itemFlagsTable.findFirst({
          where: eq(itemFlagsTable.itemId, item.id),
        });
        assertIsDefined(flagContent);
        expect(flagContent.type).toEqual(payload.type);
      });

      it('Bad request if item id is not valid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/flags`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item is not found', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/flags`,
          payload,
        });
        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });

      it('Bad request if payload is not valid', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({ items: [{}] });
        assertIsDefined(actor);
        mockAuthenticate(actor);

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
