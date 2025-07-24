import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { AddressInfo } from 'net';
import { v4 } from 'uuid';
import { WebSocket } from 'ws';

import type { FastifyInstance } from 'fastify';

import { FolderItemFactory, HttpMethod, PermissionLevel } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { itemsRawTable, pageTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { assertIsMemberForTest } from '../../../authentication';

describe('Page routes tests', () => {
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

  describe('POST /items/pages', () => {
    it('Throws if signed out', async () => {
      const payload = FolderItemFactory();
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items/pages',
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

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items/pages',
          payload: { name: 'my page' },
        });
        expect(response.statusCode).toBe(StatusCodes.CREATED);

        // check response value
        const itemId = response.json().id;
        const newItem = await db.query.itemsRawTable.findFirst({
          where: eq(itemsRawTable.id, itemId),
        });
        expect(newItem).toBeDefined();
        const newContent = await db.query.pageTable.findFirst({
          where: eq(pageTable.itemId, itemId),
        });
        expect(newContent).toBeDefined();
      });
    });
  });

  describe('GET /items/pages/ws', () => {
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: { protocol: 'ws', pathname: '/items/pages/ws' },
        query: { id: v4() },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    it('Throws if id is incorrect', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        path: {
          protocol: 'ws',
          pathname: '/items/pages/ws',
        },
        query: { id: 'wrong-id' },
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('Allow access', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Write }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      // start server to correctly listen to websockets
      await app.listen();
      await app.ready();
      const port = (app.server.address() as AddressInfo)!.port;
      const ws = new WebSocket(`http://localhost:${port}/items/pages/ws?id=${item.id}`);

      await new Promise((done, reject) => {
        ws.on('error', () => {
          // should not throw
          reject();
        });

        ws.on('message', () => {
          // should be able to receive messages
          done(true);
        });
      });
    });
  });
});
