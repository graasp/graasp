import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import { clearDatabase } from '../../../../../../test/app';
import { saveMember } from '../../../../member/test/fixtures/members';
import { TestWsClient } from '../../../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../../../websockets/test/ws-app';
import { ItemTestUtils } from '../../../test/fixtures/items';
import {
  ChildItemEvent,
  ItemEvent,
  ItemOpFeedbackErrorEvent,
  ItemOpFeedbackEvent,
  SelfItemEvent,
  itemTopic,
  memberItemsTopic,
} from '../../../ws/events';
import { RecycledItemDataRepository } from '../repository';
import { RecycleBinEvent } from '../ws/events';

// mock datasource
jest.mock('../../../../../plugins/datasource');
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

  describe('on recycle', () => {
    it('receives deletion update when item is recycled', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const itemUpdates = await ws.subscribe<ItemEvent>({ topic: itemTopic, channel: item.id });

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
        const [selfDelete] = itemUpdates;
        expect(selfDelete).toMatchObject(SelfItemEvent('delete', updatedItem));
      });
    });

    it('item in the recycled subtree receives deletion update when top item is recycled', async () => {
      const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: childItem } = await testUtils.saveItemAndMembership({
        member: actor,
        parentItem,
      });
      const itemUpdates = await ws.subscribe<ItemEvent>({
        topic: itemTopic,
        channel: childItem.id,
      });

      const res = await app.inject({
        method: HttpMethod.Post,
        url: `/items/recycle?id=${parentItem.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });
      const updatedItem = await testUtils.rawItemRepository.findOne({
        where: { id: childItem.id },
        withDeleted: true,
      });
      if (!updatedItem) throw new Error('item should be found in test');

      await waitForExpect(() => {
        const [selfDelete] = itemUpdates;
        expect(selfDelete).toMatchObject(SelfItemEvent('delete', updatedItem));
      });
    });

    it('parent item receives child deletion update when child item is recycled', async () => {
      const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: childItem } = await testUtils.saveItemAndMembership({
        parentItem,
        member: actor,
      });
      const itemUpdates = await ws.subscribe<ItemEvent>({
        topic: itemTopic,
        channel: parentItem.id,
      });

      const res = await app.inject({
        method: HttpMethod.Post,
        url: `/items/recycle?id=${childItem.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });
      const updatedItem = await testUtils.rawItemRepository.findOne({
        where: { id: childItem.id },
        withDeleted: true,
      });
      if (!updatedItem) throw new Error('item should be found in test');

      await waitForExpect(() => {
        const [childDelete] = itemUpdates;
        expect(childDelete).toMatchObject(ChildItemEvent('delete', updatedItem));
      });
    });

    it('parent in the recycled subtree receives deletion update of child when top item is recycled', async () => {
      const { item: topItem } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: parentItem } = await testUtils.saveItemAndMembership({
        member: actor,
        parentItem: topItem,
      });
      const { item: childItem } = await testUtils.saveItemAndMembership({
        parentItem,
        member: actor,
      });
      const itemUpdates = await ws.subscribe<ItemEvent>({
        topic: itemTopic,
        channel: parentItem.id,
      });

      const res = await app.inject({
        method: HttpMethod.Post,
        url: `/items/recycle?id=${topItem.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });
      const updatedChild = await testUtils.rawItemRepository.findOne({
        where: { id: childItem.id },
        withDeleted: true,
      });
      if (!updatedChild) throw new Error('item should be found in test');
      const updatedParent = await testUtils.rawItemRepository.findOne({
        where: { id: parentItem.id },
        withDeleted: true,
      });
      if (!updatedParent) throw new Error('item should be found in test');

      await waitForExpect(() => {
        expect(itemUpdates.find((v) => v.kind === 'self')).toMatchObject(
          SelfItemEvent('delete', updatedParent),
        );
        expect(itemUpdates.find((v) => v.kind === 'child')).toMatchObject(
          ChildItemEvent('delete', updatedChild),
        );
      });
    });
  });

  describe('on restore', () => {
    it('parent item receives creation update when item is restored', async () => {
      const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
      const { item: childItem } = await testUtils.saveItemAndMembership({
        member: actor,
        parentItem,
      });

      const recycle = await app.inject({
        method: HttpMethod.Post,
        url: `/items/recycle?id=${childItem.id}`,
      });
      expect(recycle.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });

      const itemUpdates = await ws.subscribe<ItemEvent>({
        topic: itemTopic,
        channel: parentItem.id,
      });

      const restore = await app.inject({
        method: HttpMethod.Post,
        url: `/items/restore?id=${childItem.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(0);
      });
      const updatedItem = await testUtils.rawItemRepository.findOne({
        where: { id: childItem.id },
      });
      if (!updatedItem) throw new Error('item should be found in test');

      await waitForExpect(async () => {
        const [childCreate] = itemUpdates;
        expect(childCreate).toMatchObject(ChildItemEvent('create', updatedItem));
      });
    });

    it('admins receive recycle bin delete update when item is recycled', async () => {
      const anna = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member: anna });
      await testUtils.saveMembership({ item, member: actor, permission: PermissionLevel.Admin });

      // send recycle request as admin Anna
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const recycle = await app.inject({
        method: HttpMethod.Post,
        url: `/items/recycle?id=${item.id}`,
      });
      expect(recycle.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });

      // send subscription as user
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = actor;
      });
      const memberItemsUpdates = await ws.subscribe<ItemEvent>({
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
      const updatedItem = await testUtils.rawItemRepository.findOne({
        where: { id: item.id },
      });
      if (!updatedItem) throw new Error('item should be found in test');

      await waitForExpect(async () => {
        const [recycleDelete] = memberItemsUpdates;
        expect(recycleDelete).toMatchObject(RecycleBinEvent('delete', updatedItem));
      });
    });
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
        const [_ownCreate, _recycleCreate, _accessibleCreate, feedbackUpdate] = memberUpdates;
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
