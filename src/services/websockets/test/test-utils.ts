/**
 * graasp-plugin-websockets
 *
 * Test utility functions and configuration
 */
import WebSocket from 'ws';

import fastify from 'fastify';
import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify/types/instance';

import { Websocket } from '@graasp/sdk';

import { REDIS_HOST } from '../../../utils/config';
import { AjvMessageSerializer } from '../message-serializer';
import graaspWebSockets, { WebsocketsPluginOptions } from '../service-api';
import { WebSocketChannels } from '../ws-channels';
import { mockSessionPreHandler, mockValidateSession } from './mocks';

const clientSerdes = { serialize: JSON.stringify, parse: JSON.parse };
const serverSerdes = new AjvMessageSerializer();

/**
 * Test config type
 * Specifies server configuration for test run
 */
export type TestConfig = Partial<WebsocketsPluginOptions> & {
  host: string;
  port: number;
};

/**
 * Creates a default local config for tests with 127.0.0.1 host and /ws prefix
 * @param options server configuration
 */
export function createDefaultLocalConfig(
  options: { port: number } & Partial<TestConfig>,
): Required<TestConfig> {
  return {
    host: options.host || '127.0.0.1',
    port: options.port,
    prefix: options.prefix || '/ws',
    redis: options.redis || {
      config: {
        host: REDIS_HOST,
      },
      channelName: 'notifications',
    },
  };
}

/**
 * Utility class to generate new port numbers
 */
export class PortGenerator {
  port: number;

  constructor(initPort: number) {
    this.port = initPort;
  }

  getNewPort(): number {
    this.port += 1;
    return this.port;
  }
}

/**
 * Create a barebone websocket server and decorate it with the channels abstraction
 * @param config TestConfig for this server
 * @param heartbeatInterval heartbeat time interval to check keepalive connections, MUST be an order of magnitude higher than a network message roundtrip
 * @returns Object containing channels server and underlying ws server
 */
export function createWsChannels(
  config: TestConfig,
  heartbeatInterval: number = 30000,
): {
  channels: WebSocketChannels;
  wss: WebSocket.Server;
} {
  const server = new WebSocket.Server({ port: config.port });
  const wsChannels = new WebSocketChannels(
    server,
    serverSerdes.serialize,
    console,
    heartbeatInterval,
  );

  server.on('connection', (ws) => {
    wsChannels.clientRegister(ws);
  });

  server.on('error', (err) => {
    throw err;
  });

  return {
    channels: wsChannels,
    wss: server,
  };
}

/**
 * In test mode, websocket channels are available
 */
declare module 'fastify' {
  interface FastifyInstance {
    _debug_websocketsChannels: WebSocketChannels;
  }
}

/**
 * Creates a barebone fastify server
 * @param config TestConfig for this server
 * @param setupFn a setup function applied to the fastify instance before starting the server
 * @returns Promise of fastify server instance
 */
export async function createFastifyInstance(
  config: TestConfig,
  setupFn: (instance: FastifyInstance) => Promise<void> = (_) => Promise.resolve(),
): Promise<FastifyInstance> {
  const promise = new Promise<FastifyInstance>((resolve, reject) => {
    const server = fastify({ logger: true });

    server.verifyAuthentication = mockValidateSession;
    server.addHook('preHandler', mockSessionPreHandler);

    setupFn(server).then(() => {
      server.listen(config.port, config.host, (err, _addr) => {
        if (err) {
          reject(err.message);
        }
        resolve(server);
      });
    });
  });

  return promise;
}

/**
 * Creates a fastify server in which graasp-plugin-websockets plugin was registered
 * @param config TestConfig for this server
 * @returns Promise of fastify server instance with graasp-plugin-websockets plugin
 */
export async function createWsFastifyInstance(
  config: Required<TestConfig>,
  setupFn: (instance: FastifyInstance) => Promise<void> = (_) => Promise.resolve(),
): Promise<FastifyInstance> {
  return createFastifyInstance(config, async (instance) => {
    // plugin must be registered inside this function parameter as it cannot be
    // added after the instance has already booted
    await setupFn(instance);
    await instance.register(fp(graaspWebSockets), config);
  });
}

/**
 * Creates a connection URL for a WebSocket.Client given
 * a host, port and prefix config
 * @param config TestConfig for this server
 */
export function createConnUrl(config: TestConfig): string {
  return `ws://${config.host}:${config.port}${config.prefix ?? '/ws'}`;
}

/**
 * Create a barebone websocket client
 * @param config TestConfig for this server
 * @returns Promise of websocket client
 */
export async function createWsClient(config: TestConfig): Promise<WebSocket> {
  return new Promise((resolve, _reject) => {
    const client = new WebSocket(createConnUrl(config));
    client.on('open', () => resolve(client));
  });
}

/**
 * Create N barebone websocket clients
 * @param config TestConfig for this server
 * @param numberClients Number of websocket clients to spawn
 * @returns Promise of Array of N websocket clients
 */
export async function createWsClients(
  config: TestConfig,
  numberClients: number,
): Promise<Array<WebSocket>> {
  const clients = Array(numberClients)
    .fill(null)
    .map((_) => createWsClient(config));
  return Promise.all(clients);
}

/**
 * Waits for a client to receive a given number of messages
 * @param client Subject ws client that waits for messages
 * @param numberMessages Number of messages to wait for
 * @returns Received message if numberMessages == 1, else array of received messages
 */
export async function clientWait(
  client: WebSocket,
  numberMessages: number,
): Promise<Websocket.ServerMessage | Array<Websocket.ServerMessage>> {
  return new Promise((resolve, reject) => {
    client.on('error', (err) => {
      reject(err);
    });

    if (numberMessages === 1) {
      client.on('message', (data) => {
        const msg = clientSerdes.parse(data.toString());
        if (msg === undefined)
          reject(new Error(`Parsing error: server message could not be converted: ${data}`));
        else resolve(msg);
      });
    } else {
      const buffer: Array<Websocket.ServerMessage> = [];
      client.on('message', (data) => {
        const msg = clientSerdes.parse(data.toString());
        if (msg === undefined)
          reject(new Error(`Parsing error: server message could not be converted: ${data}`));
        else buffer.push(msg);
        if (buffer.length === numberMessages) {
          resolve(buffer);
        }
      });
    }
  });
}

/**
 * Waits for an array of clients to receive a give number of messages
 * @param clients Array of clients that wait for messages
 * @param numberMessages Number of messages to wait for
 * @returns Array containing the received message or array of received messages for each client
 */
export async function clientsWait(
  clients: Array<WebSocket>,
  numberMessages: number,
): Promise<Array<Websocket.ServerMessage | Array<Websocket.ServerMessage>>> {
  return Promise.all(clients.map((client) => clientWait(client, numberMessages)));
}

/**
 * Performs necessary conversion to send valid message from client
 * @param client WebSocket client to send from
 * @param data ClientMessage to be sent
 */
export function clientSend(client: WebSocket, data: Websocket.ClientMessage): void {
  client.send(clientSerdes.serialize(data));
}

/**
 * Expects a subscription to a given channel
 * @param client
 * @param channel
 */
export async function expectClientSubscribe(
  client: WebSocket,
  topic: string,
  channel: string,
): Promise<void> {
  const ack = clientWait(client, 1);
  const req: Websocket.ClientMessage = {
    realm: Websocket.Realms.Notif,
    action: Websocket.ClientActions.Subscribe,
    topic,
    channel,
  };
  clientSend(client, req);
  return expect(await ack).toStrictEqual({
    realm: Websocket.Realms.Notif,
    type: Websocket.ServerMessageTypes.Response,
    status: Websocket.ResponseStatuses.Success,
    req,
  });
}
