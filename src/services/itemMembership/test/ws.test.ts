import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { HttpMethod, PermissionLevel, Websocket, parseStringToDate } from '@graasp/sdk';

import { clearDatabase, mockAuthenticate } from '../../../../test/app';
import { MemberCannotAccess } from '../../../utils/errors';
import { expectDeleteMembershipFeedback } from '../../item/plugins/action/test/utils';
import { ItemTestUtils } from '../../item/test/fixtures/items';
import { saveMember } from '../../member/test/fixtures/members';
import { TestWsClient } from '../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../websockets/test/ws-app';
import { ItemMembership } from '../entities/ItemMembership';
import { ItemMembershipEvent, MembershipEvent, itemMembershipsTopic } from '../ws/events';

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

  describe('Subscribe to membership', () => {
    it('subscribes to item memberships successfully', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });

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
      const anna = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member: anna });
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
    it('receives item membership create event', async () => {
      const anna = await saveMember();
      const bob = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member: anna });
      await testUtils.saveMembership({
        item,
        member: actor,
        permission: PermissionLevel.Read,
      });

      const membershipUpdates = await ws.subscribe<MembershipEvent>({
        topic: itemMembershipsTopic,
        channel: item.id,
      });

      // perform request as anna
      mockAuthenticate(anna);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/item-memberships/${item.id}`,
        payload: { memberships: [{ memberId: bob.id, permission: PermissionLevel.Read }] },
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      const [membership] = response.json();

      await waitForExpect(() => {
        const [membershipCreate] = membershipUpdates;
        expect(membershipCreate).toMatchObject(
          ItemMembershipEvent('create', parseStringToDate(membership) as ItemMembership),
        );
      });
    });
  });

  describe('on update membership', () => {
    it('receives item membership update event', async () => {
      const anna = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member: anna });
      const membership = await testUtils.saveMembership({
        item,
        member: actor,
        permission: PermissionLevel.Read,
      });

      const membershipUpdates = await ws.subscribe<MembershipEvent>({
        topic: itemMembershipsTopic,
        channel: item.id,
      });

      // perform request as anna
      mockAuthenticate(anna);

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/item-memberships/${membership.id}`,
        payload: { permission: PermissionLevel.Admin },
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      const result = response.json();

      await waitForExpect(() => {
        const [membershipUpdate] = membershipUpdates;
        expect(membershipUpdate).toMatchObject(
          ItemMembershipEvent('update', parseStringToDate(result) as ItemMembership),
        );
      });
    });
  });

  describe('on delete membership', () => {
    it('receives item membership delete event', async () => {
      const anna = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member: anna });
      const membership = await testUtils.saveMembership({
        item,
        member: actor,
        permission: PermissionLevel.Read,
      });

      const membershipUpdates = await ws.subscribe<MembershipEvent>({
        topic: itemMembershipsTopic,
        channel: item.id,
      });

      // perform request as anna
      mockAuthenticate(anna);

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/item-memberships/${membership.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.OK);

      await waitForExpect(() => {
        const [membershipUpdate] = membershipUpdates;
        expectDeleteMembershipFeedback(membershipUpdate, ItemMembershipEvent('delete', membership));
      });
    });
  });
});
