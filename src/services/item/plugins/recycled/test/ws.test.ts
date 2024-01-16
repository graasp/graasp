import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import { clearDatabase } from '../../../../../../test/app';
import {
  saveItemAndMembership,
  saveMembership,
} from '../../../../itemMembership/test/fixtures/memberships';
import { ANNA, saveMember } from '../../../../member/test/fixtures/members';
import { TestWsClient } from '../../../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../../../websockets/test/ws-app';
import { ItemRepository } from '../../../repository';
import {
  AccessibleItemsEvent,
  ChildItemEvent,
  ItemEvent,
  ItemOpFeedbackEvent,
  OwnItemsEvent,
  SelfItemEvent,
  SharedItemsEvent,
  itemTopic,
  memberItemsTopic,
} from '../../../ws/events';
import { RecycledItemDataRepository } from '../repository';
import { RecycleBinEvent } from '../ws/events';
import { saveRecycledItem } from './index.test';

// mock datasource
jest.mock('../../../../../plugins/datasource');

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
      const { item } = await saveItemAndMembership({ member: actor });
      const itemUpdates = await ws.subscribe<ItemEvent>({ topic: itemTopic, channel: item.id });

      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${item.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });
      const updatedItem = await ItemRepository.findOne({
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
      const { item: parentItem } = await saveItemAndMembership({ member: actor });
      const { item: childItem } = await saveItemAndMembership({ member: actor, parentItem });
      const itemUpdates = await ws.subscribe<ItemEvent>({
        topic: itemTopic,
        channel: childItem.id,
      });

      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${parentItem.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });
      const updatedItem = await ItemRepository.findOne({
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
      const { item: parentItem } = await saveItemAndMembership({ member: actor });
      const { item: childItem } = await saveItemAndMembership({ parentItem, member: actor });
      const itemUpdates = await ws.subscribe<ItemEvent>({
        topic: itemTopic,
        channel: parentItem.id,
      });

      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${childItem.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });
      const updatedItem = await ItemRepository.findOne({
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
      const { item: topItem } = await saveItemAndMembership({ member: actor });
      const { item: parentItem } = await saveItemAndMembership({
        member: actor,
        parentItem: topItem,
      });
      const { item: childItem } = await saveItemAndMembership({ parentItem, member: actor });
      const itemUpdates = await ws.subscribe<ItemEvent>({
        topic: itemTopic,
        channel: parentItem.id,
      });

      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${topItem.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });
      const updatedChild = await ItemRepository.findOne({
        where: { id: childItem.id },
        withDeleted: true,
      });
      if (!updatedChild) throw new Error('item should be found in test');
      const updatedParent = await ItemRepository.findOne({
        where: { id: parentItem.id },
        withDeleted: true,
      });
      if (!updatedParent) throw new Error('item should be found in test');

      await waitForExpect(() => {
        expect(itemUpdates).toContainEqual(SelfItemEvent('delete', updatedParent));
        expect(itemUpdates).toContainEqual(ChildItemEvent('delete', updatedChild));
      });
    });

    it('creator receives own items deletion update when item is recycled', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const memberItemsUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${item.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });
      const updatedItem = await ItemRepository.findOne({
        where: { id: item.id },
        withDeleted: true,
      });
      if (!updatedItem) throw new Error('item should be found in test');

      await waitForExpect(() => {
        const [ownDelete, accessibleDelete] = memberItemsUpdates;
        expect(ownDelete).toMatchObject(OwnItemsEvent('delete', updatedItem));
        expect(accessibleDelete).toMatchObject(AccessibleItemsEvent('delete', updatedItem));
      });
    });

    it('members with memberships receive shared items delete update when item is recycled', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });
      await saveMembership({ item, member: actor, permission: PermissionLevel.Read });
      const memberItemsUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      // send recycle request as admin Anna
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${item.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });
      const updatedItem = await ItemRepository.findOne({
        where: { id: item.id },
        withDeleted: true,
      });
      if (!updatedItem) throw new Error('item should be found in test');

      await waitForExpect(async () => {
        const [sharedDelete] = memberItemsUpdates;
        expect(sharedDelete).toMatchObject(SharedItemsEvent('delete', updatedItem));
      });
    });

    it('members with memberships on item in the recycled subtree receive shared items delete update when top item is recycled', async () => {
      const anna = await saveMember(ANNA);
      const { item: parentItem } = await saveItemAndMembership({ member: anna });
      const { item: childItem } = await saveItemAndMembership({ member: anna, parentItem });
      await saveMembership({ item: childItem, member: actor, permission: PermissionLevel.Read });
      const memberItemsUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      // send recycle request as admin Anna
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${parentItem.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });
      const updatedItem = await ItemRepository.findOne({
        where: { id: childItem.id },
        withDeleted: true,
      });
      if (!updatedItem) throw new Error('item should be found in test');

      await waitForExpect(async () => {
        const [sharedDelete] = memberItemsUpdates;
        expect(sharedDelete).toMatchObject(SharedItemsEvent('delete', updatedItem));
      });
    });

    it('members with multiple memberships on related items in the recycled subtree receive shared items delete update on topmost shared item only when top item is recycled', async () => {
      const anna = await saveMember(ANNA);
      const { item: topItem } = await saveItemAndMembership({ member: anna });
      const { item: parentItem } = await saveItemAndMembership({
        member: anna,
        parentItem: topItem,
      });
      const { item: childItem } = await saveItemAndMembership({ member: anna, parentItem });
      await saveMembership({ item: parentItem, member: actor, permission: PermissionLevel.Read });
      await saveMembership({ item: childItem, member: actor, permission: PermissionLevel.Admin });

      const memberItemsUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      // send recycle request as admin Anna
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${topItem.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });
      const updatedItem = await ItemRepository.findOne({
        where: { id: parentItem.id },
        withDeleted: true,
      });
      if (!updatedItem) throw new Error('item should be found in test');

      await waitForExpect(async () => {
        const [sharedDelete] = memberItemsUpdates;
        expect(sharedDelete).toMatchObject(SharedItemsEvent('delete', updatedItem));
      });
    });

    it('admins receive recycle bin create update when item is recycled', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });
      await saveMembership({ item, member: actor, permission: PermissionLevel.Admin });
      const memberItemsUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${item.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });
      const updatedItem = await ItemRepository.findOne({
        where: { id: item.id },
        withDeleted: true,
      });
      if (!updatedItem) throw new Error('item should be found in test');

      await waitForExpect(async () => {
        const [recycleCreate, sharedDelete] = memberItemsUpdates;
        expect(recycleCreate).toMatchObject(RecycleBinEvent('create', updatedItem));
        expect(sharedDelete).toMatchObject(SharedItemsEvent('delete', updatedItem));
      });
    });
  });

  describe('on restore', () => {
    it('parent item receives creation update when item is restored', async () => {
      const { item: parentItem } = await saveItemAndMembership({ member: actor });
      const { item: childItem } = await saveItemAndMembership({ member: actor, parentItem });

      const recycle = await app.inject({
        method: HttpMethod.POST,
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
        method: HttpMethod.POST,
        url: `/items/restore?id=${childItem.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(0);
      });
      const updatedItem = await ItemRepository.findOne({
        where: { id: childItem.id },
      });
      if (!updatedItem) throw new Error('item should be found in test');

      await waitForExpect(async () => {
        const [childCreate] = itemUpdates;
        expect(childCreate).toMatchObject(ChildItemEvent('create', updatedItem));
      });
    });

    it('creator receives own items creation update when item is restored', async () => {
      const { item } = await saveItemAndMembership({ member: actor });

      const recycle = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${item.id}`,
      });
      expect(recycle.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });

      const itemUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const restore = await app.inject({
        method: HttpMethod.POST,
        url: `/items/restore?id=${item.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(0);
      });
      const updatedItem = await ItemRepository.findOne({
        where: { id: item.id },
      });
      if (!updatedItem) throw new Error('item should be found in test');

      await waitForExpect(async () => {
        const [ownCreate, accessibleCreate] = itemUpdates;
        expect(ownCreate).toMatchObject(OwnItemsEvent('create', updatedItem));
        expect(accessibleCreate).toMatchObject(AccessibleItemsEvent('create', updatedItem));
      });
    });

    it('members with memberships receive shared items create update when item is restored', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });
      await saveMembership({ member: actor, item, permission: PermissionLevel.Read });

      // send recycle request as admin Anna
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${item.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

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

      // send restore request as admin Anna
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const restore = await app.inject({
        method: HttpMethod.POST,
        url: `/items/restore?id=${item.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(0);
      });
      const updatedItem = await ItemRepository.findOne({
        where: { id: item.id },
      });
      if (!updatedItem) throw new Error('item should be found in test');

      await waitForExpect(async () => {
        const [sharedCreate, accessibleCreate] = memberItemsUpdates;
        expect(sharedCreate).toMatchObject(SharedItemsEvent('create', updatedItem));
        expect(accessibleCreate).toMatchObject(AccessibleItemsEvent('create', updatedItem));
      });
    });

    it('members with memberships on item in the recycled subtree receive shared items create update when top item is restored', async () => {
      const anna = await saveMember(ANNA);
      const { item: parentItem } = await saveItemAndMembership({ member: anna });
      const { item: childItem } = await saveItemAndMembership({ member: anna, parentItem });
      await saveMembership({ member: actor, item: childItem, permission: PermissionLevel.Read });

      // send recycle request as admin Anna
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${parentItem.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

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

      // send restore request as admin Anna
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const restore = await app.inject({
        method: HttpMethod.POST,
        url: `/items/restore?id=${parentItem.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(0);
      });
      const updatedItem = await ItemRepository.findOne({
        where: { id: childItem.id },
      });
      if (!updatedItem) throw new Error('item should be found in test');

      await waitForExpect(async () => {
        const [sharedCreate, accessibleCreate] = memberItemsUpdates;
        expect(sharedCreate).toMatchObject(SharedItemsEvent('create', updatedItem));
        expect(accessibleCreate).toMatchObject(AccessibleItemsEvent('create', updatedItem));
      });
    });

    it('members with multiple memberships on related items in the recycled subtree receive shared items create update on topmost shared item only when top item is recycled', async () => {
      const anna = await saveMember(ANNA);
      const { item: topItem } = await saveItemAndMembership({ member: anna });
      const { item: parentItem } = await saveItemAndMembership({
        member: anna,
        parentItem: topItem,
      });
      const { item: childItem } = await saveItemAndMembership({ member: anna, parentItem });
      await saveMembership({ member: actor, item: parentItem, permission: PermissionLevel.Read });
      await saveMembership({ member: actor, item: childItem, permission: PermissionLevel.Admin });

      // send recycle request as admin Anna
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${parentItem.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

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

      // send restore request as admin Anna
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const restore = await app.inject({
        method: HttpMethod.POST,
        url: `/items/restore?id=${parentItem.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(0);
      });
      const updatedItem = await ItemRepository.findOne({
        where: { id: parentItem.id },
      });
      if (!updatedItem) throw new Error('item should be found in test');

      await waitForExpect(async () => {
        const [sharedCreate, accessibleCreate] = memberItemsUpdates;
        expect(sharedCreate).toMatchObject(SharedItemsEvent('create', updatedItem));
        expect(accessibleCreate).toMatchObject(AccessibleItemsEvent('create', updatedItem));
      });
    });

    it('admins receive recycle bin delete update when item is recycled', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });
      await saveMembership({ item, member: actor, permission: PermissionLevel.Admin });

      // send recycle request as admin Anna
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const recycle = await app.inject({
        method: HttpMethod.POST,
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
        method: HttpMethod.POST,
        url: `/items/restore?id=${item.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(0);
      });
      const updatedItem = await ItemRepository.findOne({
        where: { id: item.id },
      });
      if (!updatedItem) throw new Error('item should be found in test');

      await waitForExpect(async () => {
        const [recycleDelete, sharedCreate, accessibleCreate] = memberItemsUpdates;
        expect(recycleDelete).toMatchObject(RecycleBinEvent('delete', updatedItem));
        expect(sharedCreate).toMatchObject(SharedItemsEvent('create', updatedItem));
        expect(accessibleCreate).toMatchObject(AccessibleItemsEvent('create', updatedItem));
      });
    });
  });

  describe('asynchronous feedback', () => {
    it('member that initated the recycle operation receives success feedback', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${item.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(1);
      });
      const updatedItem = await ItemRepository.findOne({
        where: { id: item.id },
        withDeleted: true,
      });
      if (!updatedItem) throw new Error('item should be found in test');

      await waitForExpect(() => {
        const [_ownDelete, _recycleCreate, _accessibleCreate, feedbackUpdate] = memberUpdates;
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('recycle', [item.id], {
            data: { [item.id]: updatedItem },
            errors: [],
          }),
        );
      });
    });

    it('member that initated the recycle operation receives failure feedback', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const memberUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      jest.spyOn(RecycledItemDataRepository, 'recycleMany').mockImplementation(async () => {
        throw new Error('mock error');
      });

      const res = await app.inject({
        method: HttpMethod.POST,
        url: `/items/recycle?id=${item.id}`,
      });
      expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const [feedbackUpdate] = memberUpdates;
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('recycle', [item.id], {
            error: new Error('mock error'),
          }),
        );
      });
    });

    it('member that initated the restore operation receives success feedback', async () => {
      const item = await saveRecycledItem(actor);

      const memberUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      const restore = await app.inject({
        method: HttpMethod.POST,
        url: `/items/restore?id=${item.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        expect(await RecycledItemDataRepository.count()).toEqual(0);
      });
      const restored = await ItemRepository.findOneBy({ id: item.id });
      if (!restored) {
        throw new Error('item should be restored in test ');
      }

      await waitForExpect(() => {
        const [_ownCreate, _recycleCreate, _accessibleCreate, feedbackUpdate] = memberUpdates;
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('restore', [item.id], {
            data: { [item.id]: restored },
            errors: [],
          }),
        );
      });
    });

    it('member that initated the restore operation receives failure feedback', async () => {
      const item = await saveRecycledItem(actor);

      const memberUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      jest.spyOn(RecycledItemDataRepository, 'restoreMany').mockImplementation(async () => {
        throw new Error('mock error');
      });

      const restore = await app.inject({
        method: HttpMethod.POST,
        url: `/items/restore?id=${item.id}`,
      });
      expect(restore.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(() => {
        const [feedbackUpdate] = memberUpdates;
        expect(feedbackUpdate).toMatchObject(
          ItemOpFeedbackEvent('restore', [item.id], {
            error: new Error('mock error'),
          }),
        );
      });
    });
  });
});
