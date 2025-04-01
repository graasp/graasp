import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { FastifyInstance } from 'fastify';

import { HttpMethod, PermissionLevel, Websocket } from '@graasp/sdk';

import { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../../test/app';
import { seedFromJson } from '../../../../test/mocks/seed';
import { db } from '../../../drizzle/db';
import { assertIsDefined } from '../../../utils/assertions';
import { MemberCannotAccess } from '../../../utils/errors';
import { expectDeleteMembershipFeedback } from '../../item/plugins/action/test/utils';
import { TestWsClient } from '../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../websockets/test/ws-app';
import { ItemMembershipEvent, MembershipEvent, itemMembershipsTopic } from '../ws/events';

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

  describe('Subscribe to membership', () => {
    it('subscribes to item memberships successfully', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{ memberships: [{ account: 'actor' }] }] });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      ws = new TestWsClient(address);

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
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{}] });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      ws = new TestWsClient(address);

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
      const {
        actor,
        items: [item],
        members: [bob],
      } = await seedFromJson({
        members: [{ name: 'bob' }],
        items: [{ memberships: [{ account: 'actor', permission: PermissionLevel.Admin }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      ws = new TestWsClient(address);

      const membershipUpdates = await ws.subscribe<MembershipEvent>({
        topic: itemMembershipsTopic,
        channel: item.id,
      });

      const payload = { accountId: bob.id, permission: PermissionLevel.Read };
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/item-memberships?itemId=${item.id}`,
        payload,
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

      await waitForExpect(() => {
        const [membershipCreate] = membershipUpdates;
        expect(membershipCreate).toMatchObject(
          ItemMembershipEvent('create', expect.objectContaining(payload)),
        );
      });
    });
  });

  describe('on update membership', () => {
    it('receives item membership update event', async () => {
      const {
        actor,
        items: [item],
        itemMemberships: [membership],
      } = await seedFromJson({
        items: [
          {
            memberships: [
              { account: { name: 'bob' }, permission: PermissionLevel.Read },
              { account: 'actor', permission: PermissionLevel.Admin },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      ws = new TestWsClient(address);

      const membershipUpdates = await ws.subscribe<MembershipEvent>({
        topic: itemMembershipsTopic,
        channel: item.id,
      });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/item-memberships/${membership.id}`,
        payload: { permission: PermissionLevel.Admin },
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

      await waitForExpect(() => {
        const [membershipUpdate] = membershipUpdates;
        expect(membershipUpdate).toMatchObject(
          ItemMembershipEvent('update', { ...membership, permission: PermissionLevel.Admin }),
        );
      });
    });
  });

  describe('on delete membership', () => {
    it('receives item membership delete event', async () => {
      const {
        actor,
        items: [item],
        itemMemberships: [membership],
      } = await seedFromJson({
        items: [
          {
            memberships: [
              { account: { name: 'bob' }, permission: PermissionLevel.Read },
              { account: 'actor', permission: PermissionLevel.Admin },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      ws = new TestWsClient(address);

      const membershipUpdates = await ws.subscribe<MembershipEvent>({
        topic: itemMembershipsTopic,
        channel: item.id,
      });

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/item-memberships/${membership.id}`,
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

      await waitForExpect(() => {
        const [membershipUpdate] = membershipUpdates;
        expectDeleteMembershipFeedback(membershipUpdate, ItemMembershipEvent('delete', membership));
      });
    });
  });
});
