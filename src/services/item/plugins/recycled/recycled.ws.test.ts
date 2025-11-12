import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { itemsRawTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { TestWsClient } from '../../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../../websockets/test/ws-app';
import {
  type ItemEvent,
  ItemOpFeedbackErrorEvent,
  ItemOpFeedbackEvent,
  memberItemsTopic,
} from '../../ws/item.events';
import { RecycledItemDataRepository } from './recycled.repository';

describe('Recycle websocket hooks', () => {
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
    it('member that initated the recycle operation receives success feedback', async () => {
      const {
        items: [item],
        actor,
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      ws = new TestWsClient(address);

      const memberUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const res = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/recycle?id=${item.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const updatedItem = await db.query.itemsRawTable.findFirst({
          where: and(eq(itemsRawTable.id, item.id), isNotNull(itemsRawTable.deletedAt)),
        });
        expect(updatedItem).toBeDefined();
        assertIsDefined(updatedItem);

        // remove deleted at prop
        // remove createdAt and updatedAt because of type incompatibility
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { deletedAt, createdAt, updatedAt, ...i } = updatedItem;

        const feedbackEvent = memberUpdates.find((v) => v.kind === 'feedback');
        const expectedFeedback = ItemOpFeedbackEvent('recycle', [item.id], [updatedItem]);
        expect(feedbackEvent).toMatchObject(expectedFeedback);
      });
    });

    it('member that initated the recycle operation receives failure feedback', async () => {
      const {
        items: [item],
        actor,
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      ws = new TestWsClient(address);

      const memberUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      jest.spyOn(RecycledItemDataRepository.prototype, 'addMany').mockImplementation(async () => {
        throw new Error('mock error');
      });

      const res = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/recycle?id=${item.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const [feedbackUpdate] = memberUpdates;
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackErrorEvent('recycle', [item.id], new Error('mock error')),
        );
      });
    });

    it('member that initated the restore operation receives success feedback', async () => {
      const {
        items: [item],
        actor,
      } = await seedFromJson({
        items: [
          {
            isDeleted: true,
            memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      ws = new TestWsClient(address);

      const memberUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const restore = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/restore?id=${item.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const restored = await db.query.itemsRawTable.findFirst({
          where: and(eq(itemsRawTable.id, item.id), isNull(itemsRawTable.deletedAt)),
        });
        assertIsDefined(restored);

        const feedbackUpdate = memberUpdates.find((update) => update.kind === 'feedback');

        // remove deleted at prop
        // remove createdAt and updatedAt because of type incompatibility
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { deletedAt, createdAt, updatedAt, ...r } = restored;
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('restore', [item.id], { [item.id]: r as never }),
        );
      });
    });

    //   // flacky test is disabed for the moment
    //   it.skip('member that initated the restore operation receives failure feedback', async () => {
    //     const { item } = await testUtils.saveRecycledItem(actor);

    //     const memberUpdates = await ws.subscribe<ItemEvent>({
    //       topic: memberItemsTopic,
    //       channel: actor.id,
    //     });

    //     jest
    //       .spyOn(RecycledItemDataRepository.prototype, 'deleteManyByItemPath')
    //       .mockImplementation(async () => {
    //         throw new Error('mock error');
    //       });

    //     const restore = await app.inject({
    //       method: HttpMethod.Post,
    //       url: `/items/restore?id=${item.id}`,
    //     });
    //     expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

    //     await waitForExpect(() => {
    //       const feedbackUpdate = memberUpdates.find((update) => update.kind === 'feedback');
    //       expect(feedbackUpdate).toMatchObject(
    //         ItemOpFeedbackErrorEvent('restore', [item.id], new Error('mock error')),
    //       );
    //     });
    //   });
  });
});
