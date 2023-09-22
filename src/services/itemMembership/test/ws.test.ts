import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { HttpMethod, PermissionLevel, Websocket } from '@graasp/sdk';

import { clearDatabase } from '../../../../test/app';
import { MemberCannotAccess } from '../../../utils/errors';
import { SharedItemsEvent, memberItemsTopic } from '../../item/ws/events';
import { ANNA, saveMember } from '../../member/test/fixtures/members';
import { TestWsClient } from '../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../websockets/test/ws-app';
import { itemMembershipsTopic } from '../ws/events';
import { saveItemAndMembership } from './fixtures/memberships';

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

      const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      // perform request as anna
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

    // it('receives item membership create event', async () => {
    //   const anna = await saveMember(ANNA);
    //   const bob = await saveMember(BOB);
    //   const { item } = await saveItemAndMembership({ member: anna });
    //   await saveMembership({ item, member: bob, permission: PermissionLevel.Read });

    //   /* TODO: wtf??? the mock verifyAuthentication in buildApp is used and not overridden below??? */

    //   // subscribe as bob
    //   jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
    //     request.member = bob;
    //   });
    //   const membershipUpdates = await ws.subscribe({
    //     topic: itemMembershipsTopic,
    //     channel: item.id,
    //   });

    //   // perform request as anna
    //   jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
    //     request.member = anna;
    //   });
    //   const response = await app.inject({
    //     method: HttpMethod.POST,
    //     url: `/item-memberships/${item.id}`,
    //     payload: { memberships: [{ memberId: actor.id, permission: PermissionLevel.Read }] },
    //   });
    //   expect(response.statusCode).toBe(StatusCodes.OK);
    //   const membership = response.json();

    //   await waitForExpect(() => {
    //     const [sharedCreate] = membershipUpdates;
    //     expect(sharedCreate).toMatchObject(ItemMembershipEvent('create', membership));
    //   });
    // });
  });

  describe('on update membership', () => {
    it('receives item membership update event', async () => {
      // TODO:
    });
  });

  describe('on delete membership', () => {
    it('member receives item membership delete event', async () => {
      // TODO:
    });

    it('receives item membership delete event', async () => {
      // TODO:
    });
  });
});
