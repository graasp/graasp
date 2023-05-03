/**
 * graasp-plugin-websockets
 *
 * Fastify plugin for graasp-plugin-websockets
 *
 * Integrates the {@link WebSocketChannels} abstraction
 * in a fastify server plugin with @fastify/websocket
 */
import { RedisOptions } from 'ioredis';
import util from 'util';

import fws from '@fastify/websocket';
import { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { AjvMessageSerializer } from './message-serializer';
import { MultiInstanceChannelsBroker } from './multi-instance';
import { WebSocketChannels } from './ws-channels';
import { WebsocketService } from './ws-service';

/**
 * Type definition for plugin options
 */
interface WebsocketsPluginOptions {
  prefix?: string;
  redis?: {
    config?: RedisOptions;
    channelName?: string;
  };
}

/**
 * Helper function to destructure options into useful config params
 */
function destructureOptions(options: WebsocketsPluginOptions) {
  const prefix = options.prefix ?? '/ws';
  const redis = {
    config: {
      ...options.redis?.config,
      port: options.redis?.config?.port,
      host: options.redis?.config?.host,
      password: options.redis?.config?.password,
    },
    notifChannel: options.redis?.channelName,
  };
  return { prefix, redis };
}

/**
 * Helper function to log boot message after plugin initialization
 */
function logBootMessage(log: FastifyBaseLogger, config: WebsocketsPluginOptions) {
  // don't log password
  const publicRedisConfig = { ...config.redis, password: undefined };
  delete publicRedisConfig.config?.password;

  const prettyRedisConfig = util.inspect(publicRedisConfig, {
    breakLength: Infinity,
  });

  log.info(
    `graasp-plugin-websockets: plugin booted with prefix ${config.prefix} and Redis parameters ${prettyRedisConfig}`,
  );
}

const plugin: FastifyPluginAsync<WebsocketsPluginOptions> = async (fastify, options) => {
  // destructure passed fastify instance
  const { log, verifyAuthentication } = fastify;

  // configure plugin
  const config = destructureOptions(options);

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
  const wsMultiBroker = new MultiInstanceChannelsBroker(wsChannels, config.redis, log);

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
    fastify.get(config.prefix, { websocket: true }, (conn, req) => {
      // raw websocket client
      const client = conn.socket;
      // member from valid session
      const { member } = req;

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

  logBootMessage(log, config);
};

export default fp(plugin, {
  name: 'graasp-plugin-websockets',
});
