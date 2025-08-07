/**
 * graasp-plugin-websockets
 *
 * Tests for {@link WebSocketChannels}
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
import waitForExpect from 'wait-for-expect';
import { WebSocket } from 'ws';

import { createServerInfo } from '../message';
import {
  PortGenerator,
  createConnUrl,
  createDefaultLocalConfig,
  createWsChannels,
  createWsClients,
} from './test-utils';

const portGen = new PortGenerator(4000);

// jest.retryTimes(3, { logErrorsBeforeRetry: true });

test('adding / removing channels', () => {
  const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
  const { channels: server, wss } = createWsChannels(config);
  expect(server.channels.size).toEqual(0);
  server.channelCreate('hello', false);
  expect(server.channels.size).toEqual(1);
  expect(server.channels.get('hello')).toEqual({
    name: 'hello',
    removeIfEmpty: false,
    subscribers: new Set(),
  });
  server.channelCreate('world', false);
  expect(server.channels.size).toEqual(2);
  expect(server.channels.get('hello')).toEqual({
    name: 'hello',
    removeIfEmpty: false,
    subscribers: new Set(),
  });
  expect(server.channels.get('world')).toEqual({
    name: 'world',
    removeIfEmpty: false,
    subscribers: new Set(),
  });
  server.channelDelete('unknown');
  expect(server.channels.size).toEqual(2);
  server.channelDelete('hello');
  expect(server.channels.size).toEqual(1);
  expect(server.channels.get('hello')).toEqual(undefined);
  expect(server.channels.get('world')).toEqual({
    name: 'world',
    removeIfEmpty: false,
    subscribers: new Set(),
  });
  server.channelDelete('world');
  expect(server.channels.size).toEqual(0);
  wss.close();
});

test("lost client is gc'd by heartbeat", async () => {
  const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
  const { channels, wss } = createWsChannels(config, 100);
  const clients = await createWsClients(config, 2);
  expect(channels.subscriptions.size).toEqual(2);
  // forcefully close client 0
  clients[0].terminate();
  // client 0 should not be registered anymmore
  await waitForExpect(() => {
    expect(channels.subscriptions.size).toEqual(1);
  });
  clients.forEach((client) => client.close());
  wss.close();
});

test("empty channel gc'd by heartbeat", async () => {
  const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
  const { channels, wss } = createWsChannels(config, 100);
  // create with empty gc flag
  channels.channelCreate('test', true);
  expect(channels.channels.size).toEqual(1);
  await waitForExpect(() => {
    expect(channels.channels.size).toEqual(0);
  });
  wss.close();
});

test('send on inexistent channel', async () => {
  const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
  const { channels, wss } = createWsChannels(config);
  expect(channels.channelSend('foo', createServerInfo('hello world'))).toEqual(false);
  wss.close();
});

test('send to non-ready client', async () => {
  const config = createDefaultLocalConfig({ port: portGen.getNewPort() });
  const { channels, wss } = createWsChannels(config);
  const client = new WebSocket(createConnUrl(config));
  expect(channels.clientSend(client, createServerInfo('hello world'))).toEqual(false);
  await waitForExpect(() => {
    // wait for client to be ready for proper teardown
    expect(client.readyState).toEqual(WebSocket.OPEN);
  });
  client.close();
  wss.close();
});
