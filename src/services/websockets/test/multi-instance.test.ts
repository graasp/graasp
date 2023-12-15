/**
 * graasp-plugin-websockets
 *
 * Tests for {@link MultiInstanceChannelsBroker}
 */
import Redis from 'ioredis';
import waitForExpect from 'wait-for-expect';

import { Websocket } from '@graasp/sdk';

import {
  PortGenerator,
  clientSend,
  clientWait,
  createDefaultLocalConfig,
  createWsClient,
  createWsFastifyInstance,
} from './test-utils';

const portGen = new PortGenerator(5000);

test('multi-instance broker', async () => {
  const config1 = createDefaultLocalConfig({ port: portGen.getNewPort() });
  const config2 = createDefaultLocalConfig({ port: portGen.getNewPort() });

  // create 2 independent instance of server on 2 different ports
  const instance1 = await createWsFastifyInstance(config1);
  const instance2 = await createWsFastifyInstance(config2);

  // register same topic on both instances
  instance1.websockets.register('foo', async (_req) => {
    /* don't reject */
  });
  instance2.websockets.register('foo', async (_req) => {
    /* don't reject */
  });

  const client1 = await createWsClient(config1);
  const client2 = await createWsClient(config2);

  // subscribe each client to a respective broker instance on channel "test"
  const ack1 = clientWait(client1, 1);
  const ack2 = clientWait(client2, 1);
  const req: Websocket.ClientSubscribe = {
    realm: Websocket.Realms.Notif,
    action: Websocket.ClientActions.Subscribe,
    channel: 'test',
    topic: 'foo',
  };
  clientSend(client1, req);
  clientSend(client2, req);
  const ack1Msg = await ack1;
  const ack2Msg = await ack2;
  const expected = {
    realm: Websocket.Realms.Notif,
    type: Websocket.ServerMessageTypes.Response,
    status: Websocket.ResponseStatuses.Success,
    request: req,
  };
  expect(ack1Msg).toStrictEqual(expected);
  expect(ack2Msg).toStrictEqual(expected);

  // broker dispatch should be received by both clients
  const test1 = clientWait(client1, 1);
  const test2 = clientWait(client2, 1);
  const msg = {
    hello: 'world',
  };
  instance1.websockets.publish('foo', 'test', msg);
  const values = await Promise.all([test1, test2]);
  values.forEach((value) => {
    expect(value).toStrictEqual({
      realm: Websocket.Realms.Notif,
      type: Websocket.ServerMessageTypes.Update,
      topic: 'foo',
      channel: 'test',
      body: msg,
    });
  });

  // broker broadcast should be received by both clients
  const b1 = clientWait(client1, 1);
  const b2 = clientWait(client2, 1);
  const broadcast = {
    baz: 42,
  };
  instance2.websockets.publish('foo', 'broadcast', broadcast);
  const values2 = await Promise.all([b1, b2]);
  values2.forEach((value) => {
    expect(value).toStrictEqual({
      realm: Websocket.Realms.Notif,
      type: Websocket.ServerMessageTypes.Update,
      topic: 'foo',
      channel: 'broadcast',
      body: broadcast,
    });
  });

  client1.close();
  client2.close();
  await instance1.close();
  await instance2.close();
});

test('incorrect Redis message format', async () => {
  const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
  let logInfoSpy;
  const server = await createWsFastifyInstance(config, async (instance) => {
    logInfoSpy = jest.spyOn(instance.log, 'info');
  });
  const pub = new Redis({
    host: config.redis.config.host,
  });
  pub.publish(config.redis.channelName, JSON.stringify('Mock invalid redis message'));
  await waitForExpect(() => {
    expect(logInfoSpy).toHaveBeenCalledWith(
      `graasp-plugin-websockets: MultiInstanceChannelsBroker incorrect message received from Redis channel "${config.redis.channelName}": "Mock invalid redis message"`,
    );
  });
  pub.disconnect();
  server.close();
});
