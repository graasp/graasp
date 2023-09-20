import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { saveItemAndMembership } from '../../../../itemMembership/test/fixtures/memberships';
import { Member } from '../../../../member/entities/member';
import { TestWsClient } from '../../../../websockets/test/test-websocket-client';
import { Item } from '../../../entities/Item';
import { ItemEvent, SelfItemEvent, itemTopic, memberItemsTopic } from '../../../ws/events';
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
      const [selfDelete] = itemUpdates;
      const [ownDelete, recycleCreate] = memberItemsUpdates;
      expect(selfDelete).toMatchObject(SelfItemEvent('delete', serialize(item)));
      expect(recycleCreate).toMatchObject(RecycleBinEvent('create', serialize(item)));
    });
  });
});
