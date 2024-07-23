import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { HttpMethod, ItemOpFeedbackEvent as ItemOpFeedbackEventType } from '@graasp/sdk';

import { clearDatabase } from '../../../../test/app';
import { TestWsClient } from '../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../websockets/test/ws-app';
import { FolderItem, Item } from '../entities/Item';
import {
  expectCopyFeedbackOp,
  expectDeleteFeedbackOp,
  expectMoveFeedbackOp,
  expectUpdateFeedbackOp,
} from '../plugins/action/test/utils';
import { ItemRepository } from '../repository';
import { ItemOpFeedbackErrorEvent, ItemOpFeedbackEvent, memberItemsTopic } from '../ws/events';
import { ItemTestUtils, expectItem } from './fixtures/items';

// mock datasource
// jest.mock('../../../plugins/datasource');
const testUtils = new ItemTestUtils();

describe('Item websocket hooks', () => {
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
    it('member that initiated the updateMany operation receives success feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe<ItemOpFeedbackEventType<Item, 'update'>>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const payload = { name: 'new name' };
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/?id=${item.id}`,
        payload,
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      let updated;
      await waitForExpect(async () => {
        updated = await testUtils.rawItemRepository.findOneBy(payload);
        expect(updated).not.toBe(null);
      });

      expectItem(updated, { ...item, ...payload }, actor);

      let feedbackUpdate;
      // this feedback seems flacky, this might be because the websocket is sent from inside the transaction ?
      await waitForExpect(() => {
        feedbackUpdate = memberUpdates.find((update) => update.kind === 'feedback');
        expect(feedbackUpdate).toBeDefined();
      }, 8000);

      expectUpdateFeedbackOp(
        feedbackUpdate,
        ItemOpFeedbackEvent('update', [item.id], { [item.id]: updated }),
      );
    });

    it('member that initiated the updateMany operation receives failure feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe<ItemOpFeedbackEventType<Item, 'update'>>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      jest.spyOn(ItemRepository.prototype, 'patch').mockImplementation(() => {
        throw new Error('mock error');
      });

      const payload = { name: 'new name' };
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/?id=${item.id}`,
        payload,
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const [feedbackUpdate] = memberUpdates;
        expectUpdateFeedbackOp(
          feedbackUpdate,
          ItemOpFeedbackErrorEvent('update', [item.id], new Error('mock error')),
        );
      });
    });

    it('member that initiated the deleteMany operation receives success feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
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
        expect(await testUtils.rawItemRepository.findOneBy({ id: item.id })).toBe(null);
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
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe<ItemOpFeedbackEventType<Item, 'delete'>>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      jest.spyOn(ItemRepository.prototype, 'deleteMany').mockImplementation(() => {
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
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: newParent } = await testUtils.saveItemAndMembership({ member: actor });
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
        moved = await testUtils.rawItemRepository.findOneBy({ id: item.id });
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
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: newParent } = await testUtils.saveItemAndMembership({ member: actor });
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
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: newParent } = await testUtils.saveItemAndMembership({ member: actor });
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

      let copied;
      await waitForExpect(async () => {
        [copied] = await testUtils.itemRepository.getDescendants(newParent as FolderItem);
        expect(copied).toBeDefined();
      });

      await waitForExpect(() => {
        const [feedbackUpdate] = memberUpdates;
        expectCopyFeedbackOp(
          feedbackUpdate,
          ItemOpFeedbackEvent('copy', [item.id], { copies: [copied], items: [item] }),
        );
      });
    });

    it('member that initiated the copy operation receives failure feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: newParent } = await testUtils.saveItemAndMembership({ member: actor });
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
