import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { HttpMethod, PermissionLevel, Websocket, parseStringToDate } from '@graasp/sdk';

import { clearDatabase } from '../../../../test/app';
import { MemberCannotAccess } from '../../../utils/errors';
import { ItemEvent, SharedItemsEvent, memberItemsTopic } from '../../item/ws/events';
import { ANNA, BOB, saveMember } from '../../member/test/fixtures/members';
import { TestWsClient } from '../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../websockets/test/ws-app';
import { ItemMembershipEvent, MembershipEvent, itemMembershipsTopic } from '../ws/events';
import { saveItemAndMembership, saveMembership } from './fixtures/memberships';

// mock datasource
jest.mock('../../../plugins/datasource');

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

  describe('Subscribe to membership', () => {
    it('subscribes to item memberships successfully', async () => {
      const { item } = await saveItemAndMembership({ member: actor });

      const request = {
        realm: Websocket.Realms.Notif,
        topic: itemMembershipsTopic,
        channel: item.id,
        action: Websocket.ClientActions.Subscribe,
      };

      const res = await ws.send(request);
      expect(res).toEqual({
        realm: Websocket.Realms.Notif,
        type: Websocket.ServerMessageTypes.Response,
        status: Websocket.ResponseStatuses.Success,
        request: request,
      });
    });

    it('cannot subscribe to item memberships with no membership', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });
      const request = {
        realm: Websocket.Realms.Notif,
        topic: itemMembershipsTopic,
        channel: item.id,
        action: Websocket.ClientActions.Subscribe,
      };

      const res = await ws.send(request);
      expect(res).toEqual({
        realm: Websocket.Realms.Notif,
        type: Websocket.ServerMessageTypes.Response,
        status: Websocket.ResponseStatuses.Error,
        request: request,
        error: new MemberCannotAccess(item.id),
      });
    });
  });

  describe('on create membership', () => {
    it('member receives shared item create event', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });

      const memberUpdates = await ws.subscribe<ItemEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      // perform request as anna
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/item-memberships/${item.id}`,
        payload: { memberships: [{ memberId: actor.id, permission: PermissionLevel.Read }] },
      });
      expect(response.statusCode).toBe(StatusCodes.OK);

      await waitForExpect(() => {
        const [sharedCreate] = memberUpdates;
        expect(sharedCreate).toMatchObject(SharedItemsEvent('create', item));
      });
    });

    it('receives item membership create event', async () => {
      const anna = await saveMember(ANNA);
      const bob = await saveMember(BOB);
      const { item } = await saveItemAndMembership({ member: anna });
      await saveMembership({
        item,
        member: actor,
        permission: PermissionLevel.Read,
      });

      const membershipUpdates = await ws.subscribe<MembershipEvent>({
        topic: itemMembershipsTopic,
        channel: item.id,
      });

      // perform request as anna
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/item-memberships/${item.id}`,
        payload: { memberships: [{ memberId: bob.id, permission: PermissionLevel.Read }] },
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      const [membership] = response.json();

      await waitForExpect(() => {
        const [membershipCreate] = membershipUpdates;
        expect(membershipCreate).toMatchObject(
          ItemMembershipEvent('create', parseStringToDate(membership)),
        );
      });
    });
  });

  describe('on update membership', () => {
    it('receives item membership update event', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });
      const membership = await saveMembership({
        item,
        member: actor,
        permission: PermissionLevel.Read,
      });

      const membershipUpdates = await ws.subscribe<MembershipEvent>({
        topic: itemMembershipsTopic,
        channel: item.id,
      });

      // perform request as anna
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/item-memberships/${membership.id}`,
        payload: { permission: PermissionLevel.Admin },
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      const result = response.json();

      await waitForExpect(() => {
        const [membershipUpdate] = membershipUpdates;
        expect(membershipUpdate).toMatchObject(
          ItemMembershipEvent('update', parseStringToDate(result)),
        );
      });
    });
  });

  describe('on delete membership', () => {
    it('member receives shared items delete event', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });
      const membership = await saveMembership({
        item,
        member: actor,
        permission: PermissionLevel.Read,
      });

      const memberUpdates = await ws.subscribe<MembershipEvent>({
        topic: memberItemsTopic,
        channel: actor.id,
      });

      // perform request as anna

      // perform request as anna
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/item-memberships/${membership.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.OK);

      await waitForExpect(() => {
        const [membershipDelete] = memberUpdates;
        expect(membershipDelete).toMatchObject(SharedItemsEvent('delete', item));
      });
    });

    it('receives item membership delete event', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });
      const membership = await saveMembership({
        item,
        member: actor,
        permission: PermissionLevel.Read,
      });

      const membershipUpdates = await ws.subscribe<MembershipEvent>({
        topic: itemMembershipsTopic,
        channel: item.id,
      });

      // perform request as anna

      // perform request as anna
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
        request.member = anna;
      });
      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/item-memberships/${membership.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.OK);

      await waitForExpect(() => {
        const [membershipUpdate] = membershipUpdates;
        expect(membershipUpdate).toMatchObject(ItemMembershipEvent('delete', membership));
      });
    });
  });
});
