/**
 * graasp-plugin-websockets
 *
 * Channels and broadcast abstractions on top of the ws library
 *
 * @author Alexandre CHAU
 */
import util from 'util';
import { Data, Server, WebSocket } from 'ws';

import { FastifyBaseLogger } from 'fastify';

import { Websocket } from '@graasp/sdk';

type WsLogger = {
  info: (obj: unknown, ...args: unknown[]) => void;
  error: (obj: unknown, ...args: unknown[]) => void;
};

/**
 * Represents a WebSocket channel which clients can subscribe to
 * @member name Name of the channel
 * @member subscribers Subscribers to the channel
 * @member removeIfEmpty whether this channel will eventually be garbage collected when empty
 */
class Channel {
  readonly name: string;
  readonly subscribers: Set<WebSocket>;
  readonly removeIfEmpty: boolean;

  constructor(name: string, removeIfEmpty: boolean) {
    this.name = name;
    this.subscribers = new Set();
    this.removeIfEmpty = removeIfEmpty;
  }

  send(
    message: Websocket.ServerMessage,
    sendFn: (client: WebSocket, msg: Websocket.ServerMessage) => boolean,
  ) {
    let ret = true;
    this.subscribers.forEach((sub) => {
      ret = ret && sendFn(sub, message);
    });
    return ret;
  }
}

/**
 * Represents a client connected to this server
 * @member ws WebSocket of this client connection
 * @member subscriptions Channels to which this client is subscribed to
 * @member isAlive Boolean that indicates if this client is still connected
 */
class Client {
  readonly ws: WebSocket;
  readonly subscriptions: Set<Channel>;
  isAlive: boolean;

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.subscriptions = new Set();
    this.isAlive = true;

    // fix: "this" in the keepAlive function must be bound to the local context!
    // otherwise the call to this.ws.on('pong') will bind this in the closure to the websocket!
    this.keepAlive = this.keepAlive.bind(this);

    // on heartbeat response, keep alive
    this.ws.on('pong', this.keepAlive);
  }

  private keepAlive() {
    // important: make sure that this refers to the Client instance!
    // when attaching to `ws` events e.g. this.ws.on('pong', <function>)
    // the passed <function> will have its `this` value bound to the `ws` instance otherwise!!!
    this.isAlive = true;
  }

  /**
   * Cleanup when removing this client
   * MUST be called when the client closes
   */
  close() {
    this.ws.off('pong', this.keepAlive);
  }

  /**
   * Pretty-print for logging
   */
  toString(): string {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ws, ...props } = this; // ws object log is not very useful
    return util.inspect(props);
  }
}

/**
 * Channels abstraction over WebSocket server
 * Logic to handle clients and channels
 */
class WebSocketChannels {
  // Underlying WebSocket server
  wsServer: Server;
  // Collection of existing channels, identified by name for lookup
  channels: Map<string, Channel>;
  // Collection of all client subscriptions, identified by socket for lookup
  subscriptions: Map<WebSocket, Client>;
  // Serializer function
  serialize: (data: Websocket.ServerMessage) => Data;
  // Heartbeat interval instance
  heartbeat: NodeJS.Timeout;
  // Logging interface
  logger: WsLogger;

  /**
   * Creates a new WebSocketChannels instance
   * @param wsServer Underlying WebSocket.Server
   * @param serialize Seralizer function to convert between JS and WebSocket on-the-wire data
   * @param log Logger output for info, error, debug, ... messages
   * @param heartbeatInterval Time interval in ms between heartbeat checks for lost connections,
   *                          MUST be at least an order of magnitude higher than network RTT
   */
  constructor(
    wsServer: Server,
    serialize: (data: Websocket.ServerMessage) => Data,
    log?: FastifyBaseLogger | Console,
    heartbeatInterval: number = 30000,
  ) {
    this.wsServer = wsServer;
    this.channels = new Map();
    this.subscriptions = new Map();
    this.serialize = serialize;
    this.logger = log
      ? {
          info: log.info.bind(log),
          error: log.error.bind(log),
        }
      : {
          // eslint-disable-next-line no-console
          info: console.info.bind(console),
          error: console.error.bind(console),
        };

    // log errors
    this.wsServer.on('error', (error) => this.logger.error(error));

    // checks lost connections every defined time interval
    this.heartbeat = setInterval(() => {
      // find clients that are not registered anymore
      this.wsServer.clients.forEach((ws) => {
        if (this.subscriptions.get(ws) === undefined) {
          this.logger.info(
            'graasp-plugin-websockets: ejecting client, orphan without subscriptions',
          );
          ws.terminate();
        }
      });
      // find registered clients that lost connection
      this.subscriptions.forEach((client, ws) => {
        // if client was already marked dead, terminate its connection
        if (client.isAlive === false) {
          // remove from this instance also
          this.clientRemove(ws);
          this.logger.info(
            `graasp-plugin-websockets: ejecting client, timeout detected. client: ${client?.toString()}`,
          );
          return ws.terminate();
        }

        // mark all as dead and then send ping
        // (which will set them alive again when pong response is received in {@link Client})
        client.isAlive = false;
        ws.ping();
      });
      // find empty channels eligible for garbage collection
      this.channels.forEach((channel, name) => {
        if (channel.removeIfEmpty && channel.subscribers.size === 0) {
          this.channelDelete(name);
          this.logger.info(
            `graasp-plugin-websockets: removing channel "${name}" with removeIfEmpty=${channel.removeIfEmpty}: no subscribers left on this instance`,
          );
        }
      });
    }, heartbeatInterval);

    // cleanup if server closes
    this.wsServer.on('close', () => {
      clearInterval(this.heartbeat);
    });
  }

  /**
   * Helper to send a message to a websocket client from this server
   * @param client WebSocket client to send to
   * @param message Data to transmit
   */
  clientSend(client: WebSocket, message: Websocket.ServerMessage): boolean {
    if (client.readyState !== WebSocket.OPEN) {
      this.logger.info(
        `graasp-plugin-websockets: attempted to send message to client that was not ready. message: ${JSON.stringify(message)}`,
      );
      return false;
    } else {
      client.send(this.serialize(message));
      return true;
    }
  }

  /**
   * Registers a new client into the channels system
   * @param ws New client to register
   */
  clientRegister(ws: WebSocket): void {
    this.subscriptions.set(ws, new Client(ws));
  }

  /**
   * Removes a client from the channels system
   * @param ws Client to remove, nothing will happen if the client is not registered
   */
  clientRemove(ws: WebSocket): boolean {
    const client = this.subscriptions.get(ws);
    if (client !== undefined) {
      client.subscriptions.forEach((channel) => {
        channel.subscribers.delete(ws);
      });
      client.close();
    }
    return this.subscriptions.delete(ws);
  }

  /**
   * Subscribe a client to a given channel, can subscribe to many channels at once
   * @param ws client to subscribe to the channel
   * @param channelName name of the channel
   */
  clientSubscribe(ws: WebSocket, channelName: string): boolean {
    const channel = this.channels.get(channelName);
    if (channel !== undefined) {
      channel.subscribers.add(ws);
      const client = this.subscriptions.get(ws);
      if (client !== undefined) {
        client.subscriptions.add(channel);
        return true;
      }
    }
    return false;
  }

  /**
   * Subscribe a client to a single given channel, removes all prior subscriptions from this client
   * @param ws client to subscribe to the channel
   * @param channelName name of the channel
   */
  clientSubscribeOnly(ws: WebSocket, channelName: string): boolean {
    const client = this.subscriptions.get(ws);
    if (client !== undefined) {
      client.subscriptions.forEach((channel) => {
        channel.subscribers.delete(ws);
        client.subscriptions.delete(channel);
      });
    }
    return this.clientSubscribe(ws, channelName);
  }

  /**
   * Unsubscribe a client from a previously given subscribed channel
   * @param ws client to unsubscribe from channel
   * @param channelName name of the channel
   */
  clientUnsubscribe(ws: WebSocket, channelName: string): boolean {
    const channel = this.channels.get(channelName);
    if (channel !== undefined) {
      channel.subscribers.delete(ws);
      const client = this.subscriptions.get(ws);
      if (client !== undefined) {
        return client.subscriptions.delete(channel);
      }
    }
    return false;
  }

  /**
   * Create a new channel given a channel name
   * @param channelName name of the new channel
   * @param removeIfEmpty whether this channel will eventually be garbage collected when empty
   */
  channelCreate(channelName: string, removeIfEmpty: boolean): void {
    const channel = new Channel(channelName, removeIfEmpty);
    this.channels.set(channelName, channel);
  }

  /**
   * Delete a channel given its name
   * @param channelName name of the channel
   * @param onlyIfEmpty remove the channel only if it has no subscribers anymore AND
   *                    its removeIfEmpty flag is set to true
   */
  channelDelete(channelName: string, onlyIfEmpty: boolean = false): boolean {
    const channel = this.channels.get(channelName);
    if (channel !== undefined) {
      // don't remove if onlyIfEmpty set but channel is not flagged, or it still has subscribers
      if (onlyIfEmpty && (!channel.removeIfEmpty || channel.subscribers.size !== 0)) {
        return false;
      }

      channel.subscribers.forEach((sub) => {
        const client = this.subscriptions.get(sub);
        if (client !== undefined) {
          client.subscriptions.delete(channel);
        }
      });
      return this.channels.delete(channelName);
    }
    return false;
  }

  /**
   * Send a message on a given channel
   * @param channelName name of the channel to send a message on
   * @param message data to transmit
   */
  channelSend(channelName: string, message: Websocket.ServerMessage): boolean {
    const channel = this.channels.get(channelName);
    if (channel !== undefined) {
      return channel.send(message, (client, message) => this.clientSend(client, message));
    }
    return false;
  }

  /**
   * Sends an object message to all connected clients
   * @param message Object to broadcast to everyone
   */
  broadcast(message: Websocket.ServerMessage): boolean {
    let ret = true;
    this.wsServer.clients.forEach((client) => {
      ret = ret && this.clientSend(client, message);
    });
    return ret;
  }

  /**
   * Cleanup on server close
   */
  close(): void {
    clearInterval(this.heartbeat);
  }
}

export { WebSocketChannels };
