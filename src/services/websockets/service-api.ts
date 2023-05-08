/**
 * graasp-plugin-websockets
 *
 * Fastify plugin for graasp-plugin-websockets
 *
 * Integrates the {@link WebSocketChannels} abstraction
 * in a fastify server plugin with @fastify/websocket
 */
import { RedisOptions } from 'ioredis';

import fws from '@fastify/websocket';
import { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { InvalidSession } from '../../utils/errors';
import { AjvMessageSerializer } from './message-serializer';
import { MultiInstanceChannelsBroker } from './multi-instance';
import { WebSocketChannels } from './ws-channels';
import { WebsocketService } from './ws-service';

/**
 * Type definition for plugin options
 */
interface WebsocketsPluginOptions {
  prefix: string;
  redis: {
    config: RedisOptions;
    channelName: string;
  };
}

/**
 * Helper function to log boot message after plugin initialization
 */
function logBootMessage(log: FastifyBaseLogger, options: WebsocketsPluginOptions) {
  const { redis, ...rest } = options;
  const { config, channelName } = redis;

  const loggedOptions = {
    ...rest,
    redis: {
      // don't log password
      ...config,
      password: undefined,
      channelName,
    },
  };
  delete loggedOptions.redis.password;

  log.info('graasp-plugin-websockets: plugin booted with options', loggedOptions);
}

const plugin: FastifyPluginAsync<WebsocketsPluginOptions> = async (fastify, options) => {
  // destructure passed fastify instance
  const { log, verifyAuthentication } = fastify;

  // must await this register call: otherwise decorated properties on `fastify` are not available
  await fastify.register(fws, {
    errorHandler: (error, conn, req, reply) => {
      // remove client if needed
      if (wsChannels) {
        wsChannels.clientRemove(conn.socket);
      }
      log.error(`graasp-plugin-websockets: an error occured: ${error}\n\tDestroying connection`);
      conn.destroy();
    },
  });

  // Serializer / deserializer instance
  const serdes = new AjvMessageSerializer();

  // create channels abstraction instance
  const wsChannels = new WebSocketChannels(fastify.websocketServer, serdes.serialize, log);

  // create multi-instance channels broker
  const wsMultiBroker = new MultiInstanceChannelsBroker(wsChannels, options.redis, log);

  // create websockets service
  const wsService = new WebsocketService(wsChannels, wsMultiBroker, serdes.parse, log);

  // decorate server with service
  fastify.decorate('websockets', wsService);

  // decorate with debug internals in test mode
  if (process.env.NODE_ENV === 'test') {
    fastify.decorate('_debug_websocketsChannels', wsChannels);
  }

  fastify.register(async (fastify) => {
    // user must have valid session
    fastify.addHook('preHandler', verifyAuthentication);

    // handle incoming requests
    fastify.get(options.prefix, { websocket: true }, (conn, req) => {
      // raw websocket client
      const client = conn.socket;
      // member from valid session
      const { member } = req;

      if (!member) {
        throw new InvalidSession();
      }

      wsChannels.clientRegister(client);

      client.on('message', (msg) => wsService.handleRequest(msg, member, client));

      client.on('error', log.error);

      client.on('close', (code, reason) => {
        wsChannels.clientRemove(client);
      });
    });
  });

  // cleanup on server close
  fastify.addHook('onClose', (instance, done) => {
    wsMultiBroker.close();
    wsChannels.close();
    done();
  });

  logBootMessage(log, options);
};

export default fp(plugin, {
  name: 'graasp-plugin-websockets',
});
