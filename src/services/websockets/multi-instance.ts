/**
 * graasp-plugin-websockets
 *
 * Multi-instance broker for WS channels
 * Allows propagation of WS channels across multiple independent fastify instances through Redis
 *
 * ! In this file, we distinguish WS channels (part of the {@link WebSocketChannels} abstraction)
 * and Redis channels (from the Redis Pub/Sub mechanism which handles inter-instance communication) !
 */
import { JTDSchemaType } from 'ajv/dist/core';
import Ajv from 'ajv/dist/jtd';
import Redis, { RedisOptions } from 'ioredis';

import { FastifyBaseLogger } from 'fastify';

import { Websocket } from '@graasp/sdk';

import { serverMessageSchema } from './schemas';
import { WebSocketChannels } from './ws-channels';

/**
 * Represents deserialized messages sent over Redis
 * Wraps {@link ServerMessage} with meta to recognize underlying WS channels
 * @param realm must be REALM_NOTIF to allow future-proofing
 * @param channel name of the WS channel on which to send the notification, or "broadcast" if it should be sent to all
 * @param data data to be sent on the WS channel
 */
interface RedisMessage {
  realm: Websocket.Realm;
  channel: string | 'broadcast';
  data: Websocket.ServerMessage;
}

/**
 * Factory to transform a ServerMessage into a RedisMessage
 * @param serverMessage server message to send
 * @param channel WS channel name to send to, or "broadcast"
 */
function createRedisMessage(
  serverMessage: Websocket.ServerMessage,
  channel: string | 'broadcast',
): RedisMessage {
  return {
    realm: Websocket.Realms.Notif,
    channel: channel,
    data: serverMessage,
  };
}

/**
 * Redis message schema
 * MUST be equivalent to {@link RedisMessage}
 */
const redisMessageSchema: JTDSchemaType<RedisMessage> = {
  properties: {
    realm: { enum: ['notif'] },
    channel: { type: 'string' },
    data: serverMessageSchema,
  },
};

// Serializer / deserializer instance to convert between RedisMessage and wire JSON strings sent to / received from Redis
const ajv = new Ajv();
const redisSerdes = {
  serialize: ajv.compileSerializer(redisMessageSchema),
  parse: ajv.compileParser(redisMessageSchema),
};

// Helper to create a redis client instance
function createRedisClientInstance(redisConfig: RedisOptions, log?: FastifyBaseLogger): Redis {
  const redis = new Redis(redisConfig);

  redis.on('error', (err) => {
    log?.error(
      `graasp-plugin-websockets: MultiInstanceChannelsBroker failed to connect to Redis instance, reason:\n\t${err}`,
    );
  });

  return redis;
}

/**
 * Multi-instance broker abstraction
 * Handles connection and messages between fastify instances to transfer notifications
 */
class MultiInstanceChannelsBroker {
  // WS channels abstraction instance
  private readonly wsChannels: WebSocketChannels;
  // Redis client subscriber instance
  private readonly sub: Redis;
  // Redis client publisher instance
  private readonly pub: Redis;
  // Notif channel name
  private readonly notifChannel: string;

  constructor(
    wsChannels: WebSocketChannels,
    redisParams: {
      config: RedisOptions;
      channelName: string;
    },
    log?: FastifyBaseLogger,
  ) {
    this.wsChannels = wsChannels;
    this.notifChannel = redisParams.channelName;
    this.sub = createRedisClientInstance(redisParams.config, log);
    this.pub = createRedisClientInstance(redisParams.config, log);

    this.sub.subscribe(this.notifChannel, (err, _result) => {
      if (err) {
        log?.error(
          `graasp-plugin-websockets: MultiInstanceChannelsBroker failed to subscribe to ${this.notifChannel}, reason: ${err.message}`,
        );
        log?.error(`\t${err}`);
      }
    });

    this.sub.on('message', (channel, message) => {
      if (channel === this.notifChannel) {
        const msg = redisSerdes.parse(message);
        if (msg === undefined) {
          log?.info(
            `graasp-plugin-websockets: MultiInstanceChannelsBroker incorrect message received from Redis channel "${this.notifChannel}": ${message}`,
          );
        } else {
          // forward notification to respective channel
          if (msg.channel === 'broadcast') {
            this.wsChannels.broadcast(msg.data);
          } else {
            this.wsChannels.channelSend(msg.channel, msg.data);
          }
        }
      }
    });
  }

  /**
   * Send notification across instances INCLUDING THE CREATOR INSTANCE ITSELF
   * @param channel Name of the WS channel to send to, or "broadcast" if it should be sent to all clients across instances
   * @param notif Message to be sent on a given WS channel
   */
  dispatch(channel: string | 'broadcast', notif: Websocket.ServerMessage): void {
    const msg = createRedisMessage(notif, channel);
    const json = redisSerdes.serialize(msg);
    this.pub.publish(this.notifChannel, json);
  }

  /**
   * Closes the MultiInstanceChannelsBroker
   * MUST be called when the fastify instance stops!
   */
  async close(): Promise<void> {
    // cleanup open resources
    await this.sub.unsubscribe(Websocket.Realms.Notif);
    this.sub.disconnect();
    this.pub.disconnect();
  }
}

export { MultiInstanceChannelsBroker };
