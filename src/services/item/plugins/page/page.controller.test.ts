import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { AddressInfo } from 'net';
import { v4 } from 'uuid';
import waitForExpect from 'wait-for-expect';
import { WebSocket } from 'ws';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
// eslint-disable-next-line import/no-extraneous-dependencies
import { WebsocketProvider } from 'y-websocket';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { Doc, encodeStateAsUpdate } from 'yjs';

import type { FastifyInstance } from 'fastify';

import { FolderItemFactory, HttpMethod, ItemType, PermissionLevel } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { itemsRawTable, pageUpdateTable } from '../../../../drizzle/schema';
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
      });
    });
  });

  describe('GET /items/pages/ws', () => {
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: { protocol: 'ws', pathname: `/items/pages/${v4()}/ws` },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    it('Throws if id is incorrect', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        path: {
          protocol: 'ws',
          pathname: '/items/pages/wrong-id/ws',
        },
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('Throws if item is not a page', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Write }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        path: {
          protocol: 'ws',
          pathname: `/items/pages/${item.id}/ws`,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('Throws if have read access', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            type: ItemType.PAGE,
            memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        path: {
          protocol: 'ws',
          pathname: `/items/pages/${item.id}/ws`,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    it('Allow access', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            type: ItemType.PAGE,
            memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      // start server to correctly listen to websockets
      await app.listen();
      await app.ready();
      const port = (app.server.address() as AddressInfo)!.port;
      const ws = new WebSocket(`http://localhost:${port}/items/pages/${item.id}/ws`);

      await new Promise((done, reject) => {
        ws.on('error', (e) => {
          console.log(e);
          reject(new Error('should not throw'));
        });

        ws.on('message', () => {
          // should be able to receive messages
          done(true);
        });
      });
    });

    it('Save update', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            type: ItemType.PAGE,
            memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      // start server to correctly listen to websockets
      await app.listen();
      await app.ready();
      const port = (app.server.address() as AddressInfo)!.port;

      // connect to ws with yjs specific websocket provider
      const doc = new Doc();
      new WebsocketProvider(`ws://localhost:${port}`, `items/pages/${item.id}/ws`, doc);

      // update document
      doc.getText('mytext').insert(0, 'abc');
      const update = encodeStateAsUpdate(doc);
      doc.destroy();

      // update should be saved in db
      await waitForExpect(async () => {
        const savedUpdates = await db.query.pageUpdateTable.findMany({
          where: eq(pageUpdateTable.itemId, item.id),
        });
        expect(savedUpdates).toHaveLength(1);
        expect(Buffer.from(savedUpdates[0].update)).toEqual(Buffer.from(update));
      });
    });

    it('Init document with saved data', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            type: ItemType.PAGE,
            memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      // prefill updates in db
      const tmpDoc = new Doc();
      tmpDoc.getText('mytext').insert(0, 'abc');
      const initUpdate = encodeStateAsUpdate(tmpDoc);
      await db.insert(pageUpdateTable).values({ itemId: item.id, clock: 1, update: initUpdate });
      tmpDoc.destroy();

      // start server to correctly listen to websockets
      await app.listen();
      await app.ready();
      const port = (app.server.address() as AddressInfo)!.port;

      // connect to ws with yjs specific websocket provider
      const doc = new Doc();
      new WebsocketProvider(`ws://localhost:${port}`, `items/pages/${item.id}/ws`, doc);

      // update should be saved in db
      await waitForExpect(async () => {
        expect(Buffer.from(encodeStateAsUpdate(doc))).toEqual(Buffer.from(initUpdate));
      });

      // cleanup
      doc.destroy();
    });

    it('Init document with saved data for second document', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            type: ItemType.PAGE,
            memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      // prefill updates in db
      const tmpDoc = new Doc();
      tmpDoc.getText('mytext').insert(0, 'abc');
      const initUpdate = encodeStateAsUpdate(tmpDoc);
      await db.insert(pageUpdateTable).values({ itemId: item.id, clock: 1, update: initUpdate });
      tmpDoc.destroy();

      // start server to correctly listen to websockets
      await app.listen();
      await app.ready();
      const port = (app.server.address() as AddressInfo)!.port;

      // connect to ws with yjs specific websocket provider
      const doc = new Doc();
      new WebsocketProvider(`ws://localhost:${port}`, `items/pages/${item.id}/ws`, doc);

      // update should be saved in db
      await waitForExpect(async () => {
        expect(Buffer.from(encodeStateAsUpdate(doc))).toEqual(Buffer.from(initUpdate));
      });

      // 2nd user connects to the same item
      const doc2 = new Doc();
      new WebsocketProvider(`ws://localhost:${port}`, `items/pages/${item.id}/ws`, doc2);

      // update should be saved in db
      await waitForExpect(async () => {
        expect(Buffer.from(encodeStateAsUpdate(doc2))).toEqual(Buffer.from(initUpdate));
      });

      // cleanup
      doc.destroy();
      doc2.destroy();
    });
  });
});
