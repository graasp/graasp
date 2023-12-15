/**
 * graasp-plugin-websockets
 *
 * Tests for {@link service-api.ts}
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */
import waitForExpect from 'wait-for-expect';
import WebSocket from 'ws';

import { FastifyInstance } from 'fastify';

import { Websocket } from '@graasp/sdk';

import { createServerInfo } from '../message';
import {
  PortGenerator,
  TestConfig,
  clientSend,
  clientWait,
  clientsWait,
  createDefaultLocalConfig,
  createWsClient,
  createWsClients,
  createWsFastifyInstance,
} from './test-utils';

const portGen = new PortGenerator(7000);

describe('plugin options', () => {
  test('route prefix', async () => {
    const configWithPrefix = createDefaultLocalConfig({
      host: '127.0.0.1',
      port: portGen.getNewPort(),
      prefix: '/testPrefix',
    });
    const serverWithPrefix = await createWsFastifyInstance(configWithPrefix);
    const clientWithPrefix = await createWsClient(configWithPrefix);
    const res1 = new Promise((resolve) => clientWithPrefix.on('pong', resolve));
    clientWithPrefix.ping('withPrefix');
    expect(((await res1) as Buffer).toString()).toStrictEqual('withPrefix');

    const configNoPrefix = createDefaultLocalConfig({
      host: '127.0.0.1',
      port: portGen.getNewPort(),
    });
    const serverNoPrefix = await createWsFastifyInstance(configNoPrefix);
    const clientNoPrefix = await createWsClient(configNoPrefix);
    const res2 = new Promise((resolve) => clientNoPrefix.on('pong', resolve));
    clientNoPrefix.ping('noPrefix');
    expect(((await res2) as Buffer).toString()).toStrictEqual('noPrefix');

    clientWithPrefix.close();
    serverWithPrefix.close();
    clientNoPrefix.close();
    serverNoPrefix.close();
  });
});

describe('internal state', () => {
  const t: Partial<{
    config: Required<TestConfig>;
    server: FastifyInstance;
    client: WebSocket;
  }> = {};

  beforeEach(async () => {
    t.config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    t.server = await createWsFastifyInstance(t.config);
    t.client = await createWsClient(t.config);
  });

  afterEach(async () => {
    t.client!.close();
    await t.server!.close();
  });

  test('client connection registered', async () => {
    expect(t.server!._debug_websocketsChannels.subscriptions.size).toEqual(1);
    t.client!.close();
    await waitForExpect(() => {
      expect(t.server!._debug_websocketsChannels.subscriptions.size).toEqual(0);
    });
  });

  describe('with channels', () => {
    beforeEach(async () => {
      // register a topic with validation
      t.server!.websockets!.register('foo', async (_req) => {
        /* don't reject */
      });

      // subscribe to channel "a" and await ack
      const ack = clientWait(t.client!, 1);
      const request: Websocket.ClientMessage = {
        realm: Websocket.Realms.Notif,
        action: Websocket.ClientActions.Subscribe,
        channel: 'a',
        topic: 'foo',
      };
      clientSend(t.client!, request);

      expect(await ack).toStrictEqual({
        realm: Websocket.Realms.Notif,
        type: Websocket.ServerMessageTypes.Response,
        status: Websocket.ResponseStatuses.Success,
        request,
      });
      expect(t.server!._debug_websocketsChannels.channels.get('foo/a')?.subscribers.size).toEqual(
        1,
      );
    });

    test('flagged channel removed when last subscriber leaves', async () => {
      // unsubscribe from channel "a" and await ack
      const ack2 = clientWait(t.client!, 1);
      const request2: Websocket.ClientMessage = {
        realm: Websocket.Realms.Notif,
        action: Websocket.ClientActions.Unsubscribe,
        topic: 'foo',
        channel: 'a',
      };
      clientSend(t.client!, request2);
      expect(await ack2).toStrictEqual({
        realm: Websocket.Realms.Notif,
        type: Websocket.ServerMessageTypes.Response,
        status: Websocket.ResponseStatuses.Success,
        request: request2,
      });
      expect(t.server!._debug_websocketsChannels.channels.get('foo/a')).toBeUndefined();
    });

    test('removed client also deleted from channel subscribers', async () => {
      t.client!.close();
      await waitForExpect(() => {
        // after client closed, channels should not see it as subscriber anymore
        expect(t.server!._debug_websocketsChannels.channels.get('foo/a')?.subscribers.size).toEqual(
          0,
        );
      });
    });

    test('deleted channel with subscribers removes subscription from them', async () => {
      t.server!._debug_websocketsChannels.subscriptions.forEach((client) => {
        expect(client.subscriptions.size).toEqual(1);
      });

      t.server!._debug_websocketsChannels.channelDelete('foo/a');

      t.server!._debug_websocketsChannels.subscriptions.forEach((client) => {
        expect(client.subscriptions.size).toEqual(0);
      });
    });
  });
});

describe('client requests', () => {
  const t: Partial<{
    config: Required<TestConfig>;
    server: FastifyInstance;
    client: WebSocket;
  }> = {};

  beforeAll(async () => {
    t.config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    t.server = await createWsFastifyInstance(t.config);
    t.client = await createWsClient(t.config);
    // register a topic with validation
    t.server!.websockets!.register('foo', async (_req) => {
      /* don't reject */
    });
  });

  afterAll(async () => {
    await t.server!.close();
  });

  test('ill-formed request', async () => {
    const msg = { wrong: 'format' };
    const response = clientWait(t.client!, 1);
    t.client!.send(JSON.stringify(msg));
    expect(await response).toStrictEqual({
      realm: Websocket.Realms.Notif,
      status: Websocket.ResponseStatuses.Error,
      type: Websocket.ServerMessageTypes.Response,
      error: {
        name: 'BAD_REQUEST',
        message: 'Websocket: Request message format was not understood by the server',
      },
    });
  });

  test('subscribeOnly', async () => {
    // subscribe only 4 times in a row to 4 channels
    const acks = clientWait(t.client!, 4);
    const channels = ['1', '2', '3', '4'];
    channels.forEach((c) =>
      clientSend(t.client!, {
        realm: Websocket.Realms.Notif,
        action: Websocket.ClientActions.SubscribeOnly,
        channel: c,
        topic: 'foo',
      }),
    );
    const expectedAckMsgs = channels.map((c) => ({
      realm: Websocket.Realms.Notif,
      type: Websocket.ServerMessageTypes.Response,
      status: Websocket.ResponseStatuses.Success,
      request: {
        realm: Websocket.Realms.Notif,
        action: Websocket.ClientActions.SubscribeOnly,
        channel: c,
        topic: 'foo',
      },
    }));
    expect(await acks).toStrictEqual(expectedAckMsgs);

    // wait for a single message: should only received from channel "4"
    const msg = clientWait(t.client!, 1);
    channels.forEach((c) =>
      t.server!._debug_websocketsChannels.channelSend('foo/' + c, createServerInfo('hello' + c)),
    );
    expect(await msg).toStrictEqual({
      realm: Websocket.Realms.Notif,
      type: Websocket.ServerMessageTypes.Info,
      message: 'hello4',
    });
  });

  test('unsubscribe', async () => {
    let ack;
    let req: Websocket.ClientMessage;

    // subscribe client to channel 1
    req = {
      realm: Websocket.Realms.Notif,
      action: Websocket.ClientActions.Subscribe,
      channel: '1',
      topic: 'foo',
    };
    ack = clientWait(t.client!, 1);
    clientSend(t.client!, req);
    expect(await ack).toStrictEqual({
      realm: Websocket.Realms.Notif,
      type: Websocket.ServerMessageTypes.Response,
      status: Websocket.ResponseStatuses.Success,
      request: req,
    });

    // unsubscribe client from channel 1
    ack = clientWait(t.client!, 1);
    req = {
      realm: Websocket.Realms.Notif,
      action: Websocket.ClientActions.Unsubscribe,
      topic: 'foo',
      channel: '1',
    };
    clientSend(t.client!, req);
    expect(await ack).toStrictEqual({
      realm: Websocket.Realms.Notif,
      type: Websocket.ServerMessageTypes.Response,
      status: Websocket.ResponseStatuses.Success,
      request: req,
    });

    // expect next message to be ack for subscribing again
    // but NOT "you should not receive me"
    ack = clientWait(t.client!, 1);
    t.server!._debug_websocketsChannels.channelSend(
      'foo/1',
      createServerInfo('you should not receive me'),
    );

    // subscribe again client to channel
    req = {
      realm: Websocket.Realms.Notif,
      action: Websocket.ClientActions.Subscribe,
      channel: '1',
      topic: 'foo',
    };
    clientSend(t.client!, req);
    const ackMsg = await ack;

    expect(ackMsg).not.toMatchObject({
      message: 'you should not receive me',
    });
    expect(ackMsg).toStrictEqual({
      realm: Websocket.Realms.Notif,
      type: Websocket.ServerMessageTypes.Response,
      status: Websocket.ResponseStatuses.Success,
      request: req,
    });

    // now next message should be "hello again"
    const waitMsg = clientWait(t.client!, 1);
    t.server!._debug_websocketsChannels.channelSend('foo/1', createServerInfo('hello again'));
    const data = await waitMsg;

    expect(data).not.toMatchObject({
      body: 'you should not receive me',
    });
    expect(data).toStrictEqual({
      realm: Websocket.Realms.Notif,
      type: Websocket.ServerMessageTypes.Info,
      message: 'hello again',
    });
  });

  test('disconnect', async () => {
    expect(t.server!._debug_websocketsChannels.subscriptions.size).toEqual(1);
    clientSend(t.client!, {
      realm: Websocket.Realms.Notif,
      action: Websocket.ClientActions.Disconnect,
    });
    await waitForExpect(() => {
      expect(t.server!._debug_websocketsChannels.subscriptions.size).toEqual(0);
    });
  });
});

describe('channel send', () => {
  const t: Partial<{
    server: FastifyInstance;
    subs1: Array<WebSocket>;
    subs2: Array<WebSocket>;
    unsubs: Array<WebSocket>;
  }> = {};

  beforeAll(async () => {
    const config = createDefaultLocalConfig({ port: portGen.getNewPort() });

    t.server = await createWsFastifyInstance(config);

    // register a topic with validation
    t.server!.websockets!.register('foo', async (_req) => {
      /* don't reject */
    });

    const numClients = 5;
    let ack;

    // spawn 5 clients and sub them to channel 1
    t.subs1 = await createWsClients(config, numClients);
    ack = clientsWait(t.subs1, 1);
    t.subs1.forEach((client) =>
      clientSend(client, {
        realm: Websocket.Realms.Notif,
        action: Websocket.ClientActions.Subscribe,
        channel: '1',
        topic: 'foo',
      }),
    );
    await ack;

    // spawn 5 clients and sub them to channel 2
    t.subs2 = await createWsClients(config, numClients);
    ack = clientsWait(t.subs2, 1);
    t.subs2.forEach((client) =>
      clientSend(client, {
        realm: Websocket.Realms.Notif,
        action: Websocket.ClientActions.Subscribe,
        channel: '2',
        topic: 'foo',
      }),
    );
    await ack;

    // spawn 5 clients and don't sub them
    t.unsubs = await createWsClients(config, numClients);
  });

  afterAll(async () => {
    t.subs1!.forEach((client) => client.close());
    t.subs2!.forEach((client) => client.close());
    t.unsubs!.forEach((client) => client.close());
    await t.server!.close();
  });

  test('channel 1', async () => {
    const msg = createServerInfo('msg1');
    const test = clientsWait(t.subs1!, 1);
    delete msg.extra;
    t.server!._debug_websocketsChannels.channelSend('foo/1', msg);
    const data = await test;
    data.forEach((value) => expect(value).toStrictEqual(msg));
  });

  test('channel 2', async () => {
    const msg = createServerInfo('msg2');
    const test = clientsWait(t.subs2!, 1);
    delete msg.extra;
    t.server!._debug_websocketsChannels.channelSend('foo/2', msg);
    const data = await test;
    data.forEach((value) => expect(value).toStrictEqual(msg));
  });

  test('channel 2 but not channel 1', async () => {
    const hello2 = createServerInfo('hello2');
    delete hello2.extra;
    const hello1 = createServerInfo('hello1');
    delete hello1.extra;
    const test1 = clientsWait(t.subs1!, 1);
    const test2 = clientsWait(t.subs2!, 1);
    t.server!._debug_websocketsChannels.channelSend('foo/1', hello1);
    t.server!._debug_websocketsChannels.channelSend('foo/2', hello2);
    const data1 = await test1;
    const data2 = await test2;
    data1.forEach((value) => expect(value).toStrictEqual(hello1));
    data2.forEach((value) => expect(value).toStrictEqual(hello2));
  });

  test('broadcast', async () => {
    const broadcastMsg = createServerInfo('hello world');
    delete broadcastMsg.extra;
    const clientsShouldReceive = new Array<WebSocket>().concat(t.subs1!, t.subs2!, t.unsubs!);
    const test = clientsWait(clientsShouldReceive, 1);
    t.server!._debug_websocketsChannels!.broadcast(broadcastMsg);

    const data = await test;
    data.forEach((value) => expect(value).toStrictEqual(broadcastMsg));
  });
});

describe('error cases', () => {
  const t: Partial<{
    config: Required<TestConfig>;
    server: FastifyInstance;
    client: WebSocket;
  }> = {};

  beforeEach(async () => {
    t.config = createDefaultLocalConfig({ port: portGen.getNewPort() });
    t.server = await createWsFastifyInstance(t.config);
    t.client = await createWsClient(t.config);
  });

  afterEach(async () => {
    t.client!.close();
    await t.server!.close();
  });

  test('rejected validation', async () => {
    t.server!.websockets!.register('foo', async (_req) => {
      // always reject
      throw new Websocket.AccessDeniedError();
    });

    // subscribe to channel a, expect error response
    const ack = clientWait(t.client!, 1);
    const request: Websocket.ClientMessage = {
      realm: Websocket.Realms.Notif,
      action: Websocket.ClientActions.Subscribe,
      channel: 'a',
      topic: 'foo',
    };
    clientSend(t.client!, request);
    expect(await ack).toStrictEqual({
      realm: Websocket.Realms.Notif,
      type: Websocket.ServerMessageTypes.Response,
      status: Websocket.ResponseStatuses.Error,
      error: {
        name: 'ACCESS_DENIED',
        message: 'Websocket: Access denied for the requested resource',
      },
      request,
    });
  });
});
