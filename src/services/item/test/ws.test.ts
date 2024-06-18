import { StatusCodes } from 'http-status-codes';
import waitForExpectDefault from 'wait-for-expect';

import { HttpMethod } from '@graasp/sdk';

import { clearDatabase } from '../../../../test/app.js';
import { TestWsClient } from '../../websockets/test/test-websocket-client.js';
import { setupWsApp } from '../../websockets/test/ws-app.js';
import { FolderItem } from '../entities/Item.js';
import { ItemRepository } from '../repository.js';
import {
  ItemEvent,
  ItemOpFeedbackErrorEvent,
  ItemOpFeedbackEvent,
  memberItemsTopic,
} from '../ws/events.js';
import { ItemTestUtils, expectItem } from './fixtures/items.js';

const waitForExpect = waitForExpectDefault.default;

// mock datasource
jest.mock('../../../plugins/datasource');
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
      const memberUpdates = await ws.subscribe<ItemEvent>({
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
      // this ffedback seems flacky, this might be because the websocket is sent from inside the transaction ?
      await waitForExpect(() => {
        feedbackUpdate = memberUpdates.find((update) => update.kind === 'feedback');
        expect(feedbackUpdate).toBeDefined();
      }, 8000);

      expect(feedbackUpdate).toMatchObject(
        ItemOpFeedbackEvent('update', [item.id], { [item.id]: updated }),
      );
    });

    it('member that initiated the updateMany operation receives failure feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

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
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackErrorEvent('update', [item.id], new Error('mock error')),
        );
      });
    });

    it('member that initiated the deleteMany operation receives success feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe<ItemEvent>({
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
        const feedbackUpdate = memberUpdates.find((update) => update.kind === 'feedback');
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('delete', [item.id], { [item.id]: item }),
        );
      });
    });

    it('member that initiated the deleteMany operation receives failure feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe<ItemEvent>({
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
        const feedbackUpdate = memberUpdates.find((update) => update.kind === 'feedback');
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackErrorEvent('delete', [item.id], new Error('mock error')),
        );
      });
    });

    it('member that initiated the move operation receives success feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: newParent } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe<ItemEvent>({
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
        expect(memberUpdates.find((v) => v.kind === 'feedback')).toMatchObject(
          ItemOpFeedbackEvent('move', [item.id], { items: [item], moved: [moved] }),
        );
      });
    });

    it('member that initiated the move operation receives failure feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: newParent } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

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
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackErrorEvent('move', [item.id], new Error('mock error')),
        );
      });
    });

    it('member that initiated the copy operation receives success feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: newParent } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

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
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('copy', [item.id], { copies: [copied], items: [item] }),
        );
      });
    });

    it('member that initiated the copy operation receives failure feedback', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: newParent } = await testUtils.saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

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
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackErrorEvent('copy', [item.id], new Error('mock error')),
        );
      });
    });
  });
});
