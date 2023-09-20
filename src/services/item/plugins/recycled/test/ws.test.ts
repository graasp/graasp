import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { FastifyInstance } from 'fastify';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import {
  saveItemAndMembership,
  saveMembership,
} from '../../../../itemMembership/test/fixtures/memberships';
import { Member } from '../../../../member/entities/member';
import { ANNA, saveMember } from '../../../../member/test/fixtures/members';
import { TestWsClient } from '../../../../websockets/test/test-websocket-client';
import { Item } from '../../../entities/Item';
import {
  ChildItemEvent,
  ItemEvent,
  OwnItemsEvent,
  SelfItemEvent,
  SharedItemsEvent,
  itemTopic,
  memberItemsTopic,
} from '../../../ws/events';
import { RecycleBinEvent } from '../ws/events';

// mock datasource
jest.mock('../../../../../plugins/datasource');

const MAX_PORT = 65535;
const MIN_PORT = 1025;

function listenOnRandomPort(app: FastifyInstance): Promise<string> {
  try {
    return app.listen({
      port: Math.floor(Math.random() * (MAX_PORT - MIN_PORT)) + MIN_PORT,
      host: '0.0.0.0',
    });
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      return listenOnRandomPort(app);
    }
    throw error;
  }
}

async function setupWsApp({ member }: { member?: Member | null } = {}) {
  const { app, actor } = await build(member ? { member } : undefined);
  await app.ready();
  const address = await listenOnRandomPort(app);
  return { app, actor, address };
}

/**
 * A custom serializier for items that ignores dates that may frequently change
 * To be used with toMatchObject
 */
function serialize(item: Item): Item {
  // Dates are not parsed by JSON so ensure that they are all strings
  const serialized = JSON.parse(JSON.stringify(item));
  // Ignore dates that may frequently change on the server
  delete serialized.deletedAt;
  delete serialized.updatedAt;
  return serialized;
}

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

  it('receives deletion update when item is recycled', async () => {
    const { item } = await saveItemAndMembership({ member: actor });
    const itemUpdates = await ws.subscribe<ItemEvent>({ topic: itemTopic, channel: item.id });

    const res = await app.inject({
      method: HttpMethod.POST,
      url: `/items/recycle?id=${item.id}`,
    });
    expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

    await waitForExpect(() => {
      const [selfDelete] = itemUpdates;
      expect(selfDelete).toMatchObject(SelfItemEvent('delete', serialize(item)));
    });
  });

  it('item in the recycled subtree receives deletion update when top item is recycled', async () => {
    const { item: parentItem } = await saveItemAndMembership({ member: actor });
    const { item: childItem } = await saveItemAndMembership({ member: actor, parentItem });
    const itemUpdates = await ws.subscribe<ItemEvent>({ topic: itemTopic, channel: childItem.id });

    const res = await app.inject({
      method: HttpMethod.POST,
      url: `/items/recycle?id=${parentItem.id}`,
    });
    expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

    await waitForExpect(() => {
      const [selfDelete] = itemUpdates;
      expect(selfDelete).toMatchObject(SelfItemEvent('delete', serialize(childItem)));
    });
  });

  it('parent item receives child deletion update when child item is recycled', async () => {
    const { item: parentItem } = await saveItemAndMembership({ member: actor });
    const { item: childItem } = await saveItemAndMembership({ parentItem, member: actor });
    const itemUpdates = await ws.subscribe<ItemEvent>({ topic: itemTopic, channel: parentItem.id });

    const res = await app.inject({
      method: HttpMethod.POST,
      url: `/items/recycle?id=${childItem.id}`,
    });
    expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

    await waitForExpect(() => {
      const [childDelete] = itemUpdates;
      expect(childDelete).toMatchObject(ChildItemEvent('delete', serialize(childItem)));
    });
  });

  it('parent in the recycled subtree receives deletion update of child when top item is recycled', async () => {
    const { item: topItem } = await saveItemAndMembership({ member: actor });
    const { item: parentItem } = await saveItemAndMembership({
      member: actor,
      parentItem: topItem,
    });
    const { item: childItem } = await saveItemAndMembership({ parentItem, member: actor });
    const itemUpdates = await ws.subscribe<ItemEvent>({ topic: itemTopic, channel: parentItem.id });

    const res = await app.inject({
      method: HttpMethod.POST,
      url: `/items/recycle?id=${topItem.id}`,
    });
    expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

    await waitForExpect(() => {
      const [selfDelete, childDelete] = itemUpdates;
      expect(childDelete).toMatchObject(ChildItemEvent('delete', serialize(childItem)));
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

    await waitForExpect(() => {
      const [ownDelete] = memberItemsUpdates;
      expect(ownDelete).toMatchObject(OwnItemsEvent('delete', serialize(item)));
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
    jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
      request.member = anna;
    });
    const res = await app.inject({
      method: HttpMethod.POST,
      url: `/items/recycle?id=${item.id}`,
    });
    expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

    await waitForExpect(async () => {
      const [sharedDelete] = memberItemsUpdates;
      expect(sharedDelete).toMatchObject(SharedItemsEvent('delete', serialize(item)));
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
    jest.spyOn(app, 'verifyAuthentication').mockImplementation(async (request: any) => {
      request.member = anna;
    });
    const res = await app.inject({
      method: HttpMethod.POST,
      url: `/items/recycle?id=${parentItem.id}`,
    });
    expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

    await waitForExpect(async () => {
      const [sharedDelete] = memberItemsUpdates;
      expect(sharedDelete).toMatchObject(SharedItemsEvent('delete', serialize(childItem)));
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
      const [sharedDeleted, recycleCreate] = memberItemsUpdates;
      expect(recycleCreate).toMatchObject(RecycleBinEvent('create', serialize(item)));
    });
  });
});
