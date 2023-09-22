import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { HttpMethod, Websocket, parseStringToDate } from '@graasp/sdk';

import { clearDatabase } from '../../../../test/app';
import { MemberCannotAccess } from '../../../utils/errors';
import {
  saveItemAndMembership,
  saveMembership,
} from '../../itemMembership/test/fixtures/memberships';
import { ANNA, saveMember } from '../../member/test/fixtures/members';
import { TestWsClient } from '../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../websockets/test/ws-app';
import { ChildItemEvent, OwnItemsEvent, itemTopic, memberItemsTopic } from '../ws/events';
import { expectItem, getDummyItem } from './fixtures/items';

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

  describe('Subscribe to item', () => {
    it('subscribes to own item successfully', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const request = {
        realm: Websocket.Realms.Notif,
        topic: itemTopic,
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

    it('subscribes to item with membership successfully', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });
      await saveMembership({ item, member: actor });
      const request = {
        realm: Websocket.Realms.Notif,
        topic: itemTopic,
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

    it('cannot subscribe to item with no membership', async () => {
      const anna = await saveMember(ANNA);
      const { item } = await saveItemAndMembership({ member: anna });
      const request = {
        realm: Websocket.Realms.Notif,
        topic: itemTopic,
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

  describe('on create item', () => {
    it('parent item receives child item create update', async () => {
      const { item: parent } = await saveItemAndMembership({ member: actor });

      const itemUpdates = await ws.subscribe({ topic: itemTopic, channel: parent.id });

      const child = getDummyItem();
      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items?parentId=${parent.id}`,
        payload: child,
      });
      const res = response.json();
      expect(response.statusCode).toBe(StatusCodes.OK);
      expectItem(res, child, actor, parent);

      await waitForExpect(() => {
        const [childCreate] = itemUpdates;
        expect(childCreate).toMatchObject(ChildItemEvent('create', parseStringToDate(res)));
      });
    });

    it('creator receives own item create update', async () => {
      const itemUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

      const item = getDummyItem();
      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/items`,
        payload: item,
      });
      const res = response.json();
      expect(response.statusCode).toBe(StatusCodes.OK);
      expectItem(res, item, actor);

      await waitForExpect(() => {
        const [childCreate] = itemUpdates;
        expect(childCreate).toMatchObject(OwnItemsEvent('create', parseStringToDate(res)));
      });
    });
  });
});
