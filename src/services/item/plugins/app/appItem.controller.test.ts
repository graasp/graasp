import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';

import type { FastifyInstance } from 'fastify';

import { AppItemFactory, HttpMethod, ItemType, PermissionLevel } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { itemMembershipsTable, itemsRawTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { assertIsMemberForTest } from '../../../authentication';
import { expectItem } from '../../test/fixtures/items';

jest.mock('node-fetch');

const MOCK_URL = 'https://example.com';

describe('App Item tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  afterEach(() => {
    unmockAuthenticate();
    jest.clearAllMocks();
  });

  describe('POST /items', () => {
    it('Throws if signed out', async () => {
      const payload = { name: 'name', url: MOCK_URL };
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/apps',
        payload,
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Create successfully', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = { name: 'name', url: MOCK_URL, description: 'description' };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/apps',
          payload,
        });

        const expectedItem = {
          name: payload.name,
          type: ItemType.APP,
          extra: {
            [ItemType.APP]: {
              url: payload.url,
            },
          },
          description: payload.description,
        };

        // check response value
        const newItem = response.json();
        expect(response.statusCode).toBe(StatusCodes.OK);
        expectItem(newItem, expectedItem);

        // check item exists in db
        const item = await db.query.itemsRawTable.findFirst({
          where: eq(itemsRawTable.id, newItem.id),
        });
        expectItem(item, expectedItem);

        // a membership is created for this item
        const membership = await db.query.itemMembershipsTable.findFirst({
          where: eq(itemMembershipsTable.itemPath, newItem.path),
        });
        expect(membership?.permission).toEqual(PermissionLevel.Admin);
      });

      it('Fail to create if payload is invalid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'm',
        };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/apps',
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Fail to create if url of app is not an url', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload1 = {
          url: 'someurl',
          name: 'myapp',
        };

        const response1 = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/apps',
          payload: payload1,
        });

        expect(response1.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('PATCH /items/:id', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/apps/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Update successfully', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              ...AppItemFactory(),
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
          settings: {
            isPinned: true,
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/apps/${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        // this test a bit how we deal with extra: it replaces existing keys
        expectItem(response.json(), {
          ...item,
          ...payload,
          settings: {
            ...item.settings,
            ...payload.settings,
          },
        });
      });
    });
  });
});
