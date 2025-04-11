import { and, eq, ne } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { FastifyInstance } from 'fastify';

import {
  HttpMethod,
  ItemOpFeedbackEvent as ItemOpFeedbackEventType,
  PermissionLevel,
} from '@graasp/sdk';

import { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../../test/app';
import { seedFromJson } from '../../../../test/mocks/seed';
import { db } from '../../../drizzle/db';
import { itemsRawTable } from '../../../drizzle/schema';
import { Item } from '../../../drizzle/types';
import { assertIsDefined } from '../../../utils/assertions';
import { TestWsClient } from '../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../websockets/test/ws-app';
import { ItemRepository } from '../item.repository';
import {
  expectCopyFeedbackOp,
  expectDeleteFeedbackOp,
  expectMoveFeedbackOp,
} from '../plugins/action/test/utils';
import { ItemOpFeedbackErrorEvent, ItemOpFeedbackEvent, memberItemsTopic } from './item.events';

describe('Item websocket hooks', () => {
  let app: FastifyInstance;
  let address: string;
  let ws: TestWsClient;

  beforeAll(async () => {
    ({ app, address } = await setupWsApp());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
    ws.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('asynchronous feedback', () => {
    it('member that initiated the deleteMany operation receives success feedback', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      ws = new TestWsClient(address);

      const memberUpdates = await ws.subscribe<ItemOpFeedbackEventType<Item, 'delete'>>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/items/?id=${item.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(
          await db.query.itemsRawTable.findFirst({ where: eq(itemsRawTable.id, item.id) }),
        ).toBeUndefined();
      });

      await waitForExpect(() => {
        const feedbackUpdate = memberUpdates.find((update) => update.kind === 'feedback')!;
        expectDeleteFeedbackOp(
          feedbackUpdate,
          ItemOpFeedbackEvent('delete', [item.id], { [item.id]: item }),
        );
      });
    });

    it('member that initiated the deleteMany operation receives failure feedback', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      ws = new TestWsClient(address);

      const memberUpdates = await ws.subscribe<ItemOpFeedbackEventType<Item, 'delete'>>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      jest.spyOn(ItemRepository.prototype, 'delete').mockImplementation(() => {
        throw new Error('mock error');
      });

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/items/?id=${item.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const feedbackUpdate = memberUpdates.find((update) => update.kind === 'feedback')!;
        expectDeleteFeedbackOp(
          feedbackUpdate,
          ItemOpFeedbackErrorEvent('delete', [item.id], new Error('mock error')),
        );
      });
    });

    it('member that initiated the move operation receives success feedback', async () => {
      const {
        actor,
        items: [newParent, item],
      } = await seedFromJson({
        items: [
          { memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
          { memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      ws = new TestWsClient(address);

      const memberUpdates = await ws.subscribe<ItemOpFeedbackEventType<Item, 'move'>>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/move?id=${item.id}`,
        payload: { parentId: newParent.id },
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      let moved;
      await waitForExpect(async () => {
        moved = await db.query.itemsRawTable.findFirst({ where: eq(itemsRawTable.id, item.id) });
        expect(moved?.path).toContain(newParent.path);
      });

      await waitForExpect(() => {
        const feedback = memberUpdates.find((v) => v.kind === 'feedback')!;
        expectMoveFeedbackOp(
          feedback,
          ItemOpFeedbackEvent('move', [item.id], { items: [item], moved: [moved] }),
        );
      });
    });

    it('member that initiated the move operation receives failure feedback', async () => {
      const {
        actor,
        items: [newParent, item],
      } = await seedFromJson({
        items: [
          { memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
          { memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      ws = new TestWsClient(address);

      const memberUpdates = await ws.subscribe<ItemOpFeedbackEventType<Item, 'move'>>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      jest.spyOn(ItemRepository.prototype, 'move').mockImplementation(async () => {
        throw new Error('mock error');
      });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/move?id=${item.id}`,
        payload: { parentId: newParent.id },
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const [feedbackUpdate] = memberUpdates;
        expectMoveFeedbackOp(
          feedbackUpdate,
          ItemOpFeedbackErrorEvent('move', [item.id], new Error('mock error')),
        );
      });
    });

    it('member that initiated the copy operation receives success feedback', async () => {
      const {
        actor,
        items: [newParent, item],
      } = await seedFromJson({
        items: [
          { memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
          { memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      ws = new TestWsClient(address);

      const memberUpdates = await ws.subscribe<ItemOpFeedbackEventType<Item, 'copy'>>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/copy?id=${item.id}`,
        payload: { parentId: newParent.id },
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const [copied] = await db.query.itemsRawTable.findMany({
          where: and(eq(itemsRawTable.name, newParent.name), ne(itemsRawTable.id, item.id)),
        });
        expect(copied).toBeDefined();
        const [feedbackUpdate] = memberUpdates;
        expectCopyFeedbackOp(
          feedbackUpdate,
          ItemOpFeedbackEvent('copy', [item.id], { copies: [copied], items: [item] }),
        );
      });
    });

    it('member that initiated the copy operation receives failure feedback', async () => {
      const {
        actor,
        items: [newParent, item],
      } = await seedFromJson({
        items: [
          { memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
          { memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      ws = new TestWsClient(address);

      const memberUpdates = await ws.subscribe<ItemOpFeedbackEventType<Item, 'copy'>>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      jest.spyOn(ItemRepository.prototype, 'copy').mockImplementation(async () => {
        throw new Error('mock error');
      });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/copy?id=${item.id}`,
        payload: { parentId: newParent.id },
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const [feedbackUpdate] = memberUpdates;
        expectCopyFeedbackOp(
          feedbackUpdate,
          ItemOpFeedbackErrorEvent('copy', [item.id], new Error('mock error')),
        );
      });
    });
  });
});
