import { eq } from 'drizzle-orm';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

import type { FastifyInstance } from 'fastify';

import {
  DocumentItemExtraFlavor,
  DocumentItemFactory,
  HttpMethod,
  ItemType,
  PermissionLevel,
} from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { itemMembershipsTable, itemsRawTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { expectItem } from '../../test/fixtures/items';

const extra = {
  [ItemType.DOCUMENT]: {
    content: 'my text is here',
  },
};
describe('Document Item tests', () => {
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

  describe('POST /items', () => {
    it('Throws if signed out', async () => {
      const payload = { name: 'name', type: ItemType.DOCUMENT, extra };

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Create successfully', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = DocumentItemFactory({ extra });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items',
          payload,
        });

        // check response value
        const newItem = response.json();
        expectItem(newItem, payload);
        expect(response.statusCode).toBe(StatusCodes.OK);

        // check item exists in db
        const item = await db.query.itemsRawTable.findFirst({
          where: eq(itemsRawTable.id, newItem.id),
        });
        expectItem(item, payload);

        // a membership is created for this item
        const membership = await db.query.itemMembershipsTable.findFirst({
          where: eq(itemMembershipsTable.itemPath, newItem.path),
        });
        expect(membership?.permission).toEqual(PermissionLevel.Admin);
      });

      it('Fail to create if type does not match extra', async () => {
        const payload = {
          name: 'name',
          type: ItemType.LINK,
          extra: { [ItemType.DOCUMENT]: { content: 'content' } },
        };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items',
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Fail to create if payload is invalid', async () => {
        const payload = {
          name: 'name',
          type: ItemType.DOCUMENT,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          extra: { [ItemType.FOLDER]: { content: 'content' } } as any,
        };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items',
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Fail to create if content of document is not defined', async () => {
        const payload1 = {
          name: 'name',
          type: ItemType.DOCUMENT,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          extra: { [ItemType.DOCUMENT]: {} } as any,
        };

        const response1 = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items',
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
      } = await seedFromJson({ actor: null, items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/${item.id}`,
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              type: ItemType.DOCUMENT,
              extra: {
                [ItemType.DOCUMENT]: {
                  content: 'value',
                },
              },
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
          extra: {
            [ItemType.DOCUMENT]: {
              content: 'new value',
              // test that flavor can be updated
              flavor: DocumentItemExtraFlavor.Info,
            },
          },
          settings: {
            hasThumbnail: true,
            isCollapsible: true,
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/${item.id}`,
          payload,
        });
        // this test a bit how we deal with extra: it replaces existing keys
        expect(response.statusCode).toBe(StatusCodes.OK);

        expectItem(response.json(), {
          ...item,
          ...payload,
          extra: { ...item.extra, ...payload.extra },
          settings: { ...item.settings, ...payload.settings },
        });

        expect(response.json().settings).toMatchObject(payload.settings);
      });

      it('Bad Request if extra is invalid', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              type: ItemType.DOCUMENT,
              extra: {
                [ItemType.DOCUMENT]: {
                  content: 'value',
                },
              },
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
          extra: {
            [ItemType.LINK]: {
              content: 'new value',
            },
          },
          settings: {
            someSetting: 'value',
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      });
    });
  });
});
