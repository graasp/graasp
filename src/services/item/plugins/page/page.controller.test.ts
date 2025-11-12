import { faker } from '@faker-js/faker';
import { desc, eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import * as encoding from 'lib0/encoding';
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
import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { itemsRawTable, pageUpdateTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { assertIsMemberForTest } from '../../../authentication';
import { MESSAGE_SYNC_CODE } from './constants';
import { PageItemService } from './page.service';

async function getAppPort(app: FastifyInstance) {
  await app.ready();
  const port = (app.server.address() as AddressInfo)!.port;
  return port;
}

async function expectServerToBeResponsive(app: FastifyInstance) {
  const result = await app.inject({
    method: 'GET',
    url: '/health',
  });
  expect(result.statusCode).toEqual(StatusCodes.OK);
}

async function connectToItemWs(
  app: FastifyInstance,
  itemId: string,
  { readOnly = false }: { readOnly?: boolean } = {},
) {
  // start server to correctly listen to websockets
  const port = await getAppPort(app);

  // connect to ws with yjs specific websocket provider
  const doc = new Doc();
  const provider = new WebsocketProvider(
    `ws://localhost:${port}/api`,
    `items/pages/${itemId}/ws${readOnly ? '/read' : ''}`,
    doc,
    {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      WebSocketPolyfill: WebSocket,
    },
  );
  return { doc, provider };
}

describe('Page routes tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
    await app.listen();
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
        url: '/api/items/pages',
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
          url: '/api/items/pages',
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
    it('Throw if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: { protocol: 'ws', pathname: `/api/items/pages/${v4()}/ws` },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    it('Throw if id is incorrect', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        path: {
          protocol: 'ws',
          pathname: '/api/items/pages/wrong-id/ws',
        },
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('Throw if item is not a page', async () => {
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
          pathname: `/api/items/pages/${item.id}/ws`,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('Throw if have read access', async () => {
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
          pathname: `/api/items/pages/${item.id}/ws`,
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
      const port = await getAppPort(app);
      const ws = new WebSocket(`http://localhost:${port}/api/items/pages/${item.id}/ws`);

      await new Promise((done, reject) => {
        ws.on('error', (e) => {
          console.error(e);
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

      const { doc, provider } = await connectToItemWs(app, item.id);
      // count received messages
      const { doc: doc1, provider: countProvider } = await connectToItemWs(app, item.id);

      let count = 0;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      countProvider.ws.on('message', () => {
        count += 1;
      });

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

        // expect at least 2 messages: sync and insert update
        // sometimes can receive 3rd message where getText and insert are split
        expect(count).toBeGreaterThanOrEqual(2);
      });

      doc1.destroy();
      provider.destroy();
      countProvider.destroy();
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

      const { doc, provider } = await connectToItemWs(app, item.id);

      // update should be saved in db
      await waitForExpect(async () => {
        expect(Buffer.from(encodeStateAsUpdate(doc))).toEqual(Buffer.from(initUpdate));
      });

      // cleanup
      doc.destroy();
      provider.destroy();
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

      const { doc, provider: provider1 } = await connectToItemWs(app, item.id);

      // update should be saved in db
      await waitForExpect(async () => {
        expect(Buffer.from(encodeStateAsUpdate(doc))).toEqual(Buffer.from(initUpdate));
      });

      // 2nd user connects to the same item
      const { doc: doc2, provider: provider2 } = await connectToItemWs(app, item.id);

      // update should be saved in db
      await waitForExpect(async () => {
        expect(Buffer.from(encodeStateAsUpdate(doc2))).toEqual(Buffer.from(initUpdate));
      });

      // cleanup
      doc.destroy();
      doc2.destroy();
      provider1.destroy();
      provider2.destroy();
    });

    it('Gracefully recover if update is corrupted', async () => {
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

      // prefill incorrect update in db
      await db
        .insert(pageUpdateTable)
        .values({ itemId: item.id, clock: 1, update: Buffer.from([1, 2, 3]) });

      const { doc, provider: provider1 } = await connectToItemWs(app, item.id);

      // connection should close
      let hasClosed = false;
      provider1.on('connection-close', () => {
        hasClosed = true;
      });
      await waitForExpect(async () => {
        expect(hasClosed).toBeTruthy();
        await expectServerToBeResponsive(app);
      }, 2000);

      // cleanup
      doc.destroy();
      provider1.destroy();
    });

    it('Gracefully recover if receive corrupted ws message', async () => {
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
      const port = await getAppPort(app);
      const ws = new WebSocket(`ws://localhost:${port}/api/items/pages/${item.id}/ws`);

      // connection should close
      let hasClosed = false;
      ws.on('close', () => {
        hasClosed = true;
      });

      // wait for connection to be established before switching user
      await waitForExpect(() => {
        expect(ws.readyState).toBeTruthy();
      }, 2000);

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC_CODE);
      encoding.writeVarUint8Array(encoder, Buffer.from([1, 2, 3]));
      ws.send(encoding.toUint8Array(encoder));

      await waitForExpect(async () => {
        expect(hasClosed).toBeTruthy();
        await expectServerToBeResponsive(app);
      }, 4000);
    });
  });

  describe('GET /items/pages/ws/read', () => {
    it('Throws if id is incorrect', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        path: {
          protocol: 'ws',
          pathname: '/api/items/pages/wrong-id/ws/read',
        },
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('Throw if signed out for non-public item', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        items: [{ type: ItemType.PAGE }],
      });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: { protocol: 'ws', pathname: `/api/items/pages/${item.id}/ws/read` },
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    it('Throw if no access for non-public item', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ type: ItemType.PAGE }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      const response = await app.inject({
        method: HttpMethod.Get,
        url: { protocol: 'ws', pathname: `/api/items/pages/${item.id}/ws/read` },
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    it('Throw if item is not a page', async () => {
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
          pathname: `/api/items/pages/${item.id}/ws/read`,
        },
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('Allow access if have read access', async () => {
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

      // start server to correctly listen to websockets
      await app.ready();
      const port = (app.server.address() as AddressInfo)!.port;
      const ws = new WebSocket(`http://localhost:${port}/api/items/pages/${item.id}/ws/read`);

      await new Promise((done, reject) => {
        ws.on('error', (e) => {
          console.error(e);
          reject(new Error('should not throw'));
        });

        ws.on('message', () => {
          // should be able to receive messages
          done(true);
        });
      });

      // cleanup
      ws.close();
    });

    it('Allow access for public item without access', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            type: ItemType.PAGE,
            isPublic: true,
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      // start server to correctly listen to websockets
      await app.ready();
      const port = (app.server.address() as AddressInfo)!.port;
      const ws = new WebSocket(`http://localhost:${port}/api/items/pages/${item.id}/ws/read`);

      await new Promise((done, reject) => {
        ws.on('error', (e) => {
          console.error(e);
          reject(new Error('should not throw'));
        });

        ws.on('message', () => {
          // should be able to receive messages
          done(true);
        });
      });

      // cleanup
      ws.close();
    });

    it('Allow access for public item and signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            type: ItemType.PAGE,
            isPublic: true,
          },
        ],
      });

      // start server to correctly listen to websockets
      await app.ready();
      const port = (app.server.address() as AddressInfo)!.port;
      const ws = new WebSocket(`http://localhost:${port}/api/items/pages/${item.id}/ws/read`);

      await new Promise((done, reject) => {
        ws.on('error', (e) => {
          console.error(e);
          reject(new Error('should not throw'));
        });

        ws.on('message', () => {
          // should be able to receive messages
          done(true);
        });
      });

      // cleanup
      ws.close();
    });

    it('Init document with saved data', async () => {
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

      // prefill updates in db
      const tmpDoc = new Doc();
      tmpDoc.getText('mytext').insert(0, 'abc');
      const initUpdate = encodeStateAsUpdate(tmpDoc);
      await db.insert(pageUpdateTable).values({ itemId: item.id, clock: 1, update: initUpdate });
      tmpDoc.destroy();

      const { doc, provider } = await connectToItemWs(app, item.id, { readOnly: true });

      // update should be saved in db
      await waitForExpect(async () => {
        expect(Buffer.from(encodeStateAsUpdate(doc))).toEqual(Buffer.from(initUpdate));
      });

      // cleanup
      doc.destroy();
      provider.destroy();
    });

    it('Receive update from write document', async () => {
      const {
        actor,
        items: [item],
        members: [reader],
      } = await seedFromJson({
        items: [
          {
            type: ItemType.PAGE,
            memberships: [
              { account: 'actor', permission: PermissionLevel.Write },
              { account: { name: 'reader' }, permission: PermissionLevel.Read },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      // start server to correctly listen to websockets

      const { doc: writeDoc, provider: provider1 } = await connectToItemWs(app, item.id);
      // wait for connection to be established before switching user
      await waitForExpect(() => {
        expect(provider1.synced).toBeTruthy();
      });
      const initDoc = encodeStateAsUpdate(writeDoc);

      // connect to read document with another user
      mockAuthenticate(reader);
      const { doc: readDoc, provider: provider2 } = await connectToItemWs(app, item.id, {
        readOnly: true,
      });

      // apply update on write document
      writeDoc.getText('mytext').insert(0, 'abc');
      // const initUpdate = encodeStateAsUpdate(doc);

      // update should be received in read document
      await waitForExpect(async () => {
        // doc should be different from init
        expect(initDoc).not.toEqual(encodeStateAsUpdate(writeDoc));

        // read doc should have update
        expect(Buffer.from(encodeStateAsUpdate(readDoc))).toEqual(
          Buffer.from(encodeStateAsUpdate(writeDoc)),
        );
      });

      // cleanup
      writeDoc.destroy();
      readDoc.destroy();
      provider1.destroy();
      provider2.destroy();
    });

    it('Update from read document should not broadcast', async () => {
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

      const { doc: readDoc1, provider } = await connectToItemWs(app, item.id, {
        readOnly: true,
      });
      // wait for connection to be established before switching user
      await waitForExpect(() => {
        expect(provider.synced).toBeTruthy();
      });

      // count received messages
      const { doc: readDoc2, provider: readerProvider } = await connectToItemWs(app, item.id);
      let messageCount = 0;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      readerProvider.ws.on('message', () => {
        messageCount += 1;
      });

      // manually apply update on read document
      readDoc1.getText('mytext').insert(0, 'abc');

      // expect no message received, wait for 2 seconds
      await new Promise((done) => {
        setTimeout(() => {
          expect(messageCount).toEqual(0);
          done(true);
        }, 3000);
      });

      // cleanup
      readDoc1.destroy();
      readDoc2.destroy();
      provider.destroy();
      readerProvider.destroy();
    });

    it('Gracefully recover if update is corrupted', async () => {
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

      // prefill incorrect update in db
      await db
        .insert(pageUpdateTable)
        .values({ itemId: item.id, clock: 1, update: Buffer.from([1, 2, 3]) });

      const { doc, provider: provider1 } = await connectToItemWs(app, item.id, { readOnly: true });

      // connection should close
      let hasClosed = false;
      provider1.on('connection-close', () => {
        hasClosed = true;
      });
      await waitForExpect(async () => {
        expect(hasClosed).toBeTruthy();
      }, 2000);

      // cleanup
      doc.destroy();
      provider1.destroy();
    });

    it('Gracefully recover if receive corrupted ws message', async () => {
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
      const port = await getAppPort(app);
      const ws = new WebSocket(`ws://localhost:${port}/api/items/pages/${item.id}/ws/read`);

      // connection should close
      let hasClosed = false;
      ws.on('close', () => {
        hasClosed = true;
      });

      // wait for connection to be established before switching user
      await waitForExpect(() => {
        expect(ws.readyState).toBeTruthy();
      }, 2000);

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC_CODE);
      encoding.writeVarUint8Array(encoder, Buffer.from([1, 2, 3]));
      ws.send(encoding.toUint8Array(encoder));

      await waitForExpect(async () => {
        expect(hasClosed).toBeTruthy();
        await expectServerToBeResponsive(app);
      }, 4000);
    });
  });

  describe('copy post hook', () => {
    it('Does not copy update if item is not a page ', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        items: [{}],
      });

      const pageItemService = resolveDependency(PageItemService);
      const copySpy = jest.spyOn(pageItemService, 'copy');

      await app.inject({
        method: HttpMethod.Post,
        path: {
          pathname: '/api/items/copy',
          query: { id: item.id },
        },
      });

      // wait 2 seconds
      await new Promise((done) => {
        setTimeout(() => {
          done(true);
        }, 2000);
      });

      expect(copySpy).not.toHaveBeenCalled();
    });

    it('Copy folder with page copy updates', async () => {
      const name = faker.word.sample();
      const {
        actor,
        items: [folder, page],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
            children: [
              {
                name,
                type: ItemType.PAGE,
              },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      // prefill updates in db
      const tmpDoc = new Doc();
      tmpDoc.getText('mytext').insert(0, 'abc');
      const initUpdate = encodeStateAsUpdate(tmpDoc);
      await db.insert(pageUpdateTable).values({ itemId: page.id, clock: 1, update: initUpdate });
      tmpDoc.destroy();

      // copy folder
      const copyOp = await app.inject({
        method: HttpMethod.Post,
        path: {
          pathname: '/api/items/copy',
          query: { id: folder.id },
        },
        payload: {},
      });
      expect(copyOp.statusCode).toEqual(StatusCodes.ACCEPTED);

      // wait until copy is done
      let copy;
      await waitForExpect(async () => {
        const items = await db.query.itemsRawTable.findMany({
          where: eq(itemsRawTable.name, name),
          orderBy: desc(itemsRawTable.createdAt),
        });

        // should contain copy and original
        expect(items).toHaveLength(2);
        copy = items[0];
      }, 2000);

      // connect to copy
      const { doc, provider } = await connectToItemWs(app, copy.id);

      // should receive init update
      await waitForExpect(() => {
        expect(Buffer.from(encodeStateAsUpdate(doc))).toEqual(Buffer.from(initUpdate));
      }, 2000);

      doc.destroy();
      provider.destroy();
    });
  });
});
