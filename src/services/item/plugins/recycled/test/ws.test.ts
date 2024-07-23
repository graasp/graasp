import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { HttpMethod } from '@graasp/sdk';

import { clearDatabase } from '../../../../../../test/app';
import { TestWsClient } from '../../../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../../../websockets/test/ws-app';
import { ItemTestUtils } from '../../../test/fixtures/items';
import {
  ItemEvent,
  ItemOpFeedbackErrorEvent,
  ItemOpFeedbackEvent,
  memberItemsTopic,
} from '../../../ws/events';
import { RecycledItemDataRepository } from '../repository';

// mock datasource
// jest.mock('../../../../../plugins/datasource');
const testUtils = new ItemTestUtils();

describe('Recycle websocket hooks', () => {
  let app, actor, address;
  let ws: TestWsClient;

  beforeEach(async () => {
    ({ app, actor, address } = await setupWsApp());
    ws = new TestWsClient(address);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
    ws.close();
  });

  describe('asynchronous feedback', () => {
    it('member that initated the recycle operation receives success feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const res = await app.inject({
        method: HttpMethod.Post,
        url: `/items/recycle?id=${item.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });
      const updatedItem = await testUtils.rawItemRepository.findOne({
        where: { id: item.id },
        withDeleted: true,
      });
      if (!updatedItem) throw new Error('item should be found in test');

      await waitForExpect(() => {
        expect(memberUpdates.find((v) => v.kind === 'feedback')).toMatchObject(
          ItemOpFeedbackEvent('recycle', [item.id], { [item.id]: updatedItem }),
        );
      });
    });

    it('member that initated the recycle operation receives failure feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      jest.spyOn(RecycledItemDataRepository, 'recycleMany').mockImplementation(async () => {
        throw new Error('mock error');
      });

      const res = await app.inject({
        method: HttpMethod.Post,
        url: `/items/recycle?id=${item.id}`,
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
      const { item } = await testUtils.saveRecycledItem(actor);

      const memberUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const restore = await app.inject({
        method: HttpMethod.Post,
        url: `/items/restore?id=${item.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(0);
      });
      const restored = await testUtils.rawItemRepository.findOneBy({ id: item.id });
      if (!restored) {
        throw new Error('item should be restored in test ');
      }

      await waitForExpect(() => {
        const feedbackUpdate = memberUpdates.find((update) => update.kind === 'feedback');
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('restore', [item.id], { [item.id]: restored }),
        );
      });
    });

    // flacky test is disabed for the moment
    it.skip('member that initated the restore operation receives failure feedback', async () => {
      const { item } = await testUtils.saveRecycledItem(actor);

      const memberUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      jest.spyOn(RecycledItemDataRepository, 'restoreMany').mockImplementation(async () => {
        throw new Error('mock error');
      });

      const restore = await app.inject({
        method: HttpMethod.Post,
        url: `/items/restore?id=${item.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const feedbackUpdate = memberUpdates.find((update) => update.kind === 'feedback');
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackErrorEvent('restore', [item.id], new Error('mock error')),
        );
      });
    });
  });
});
