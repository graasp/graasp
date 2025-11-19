// needed to use decorators for Dependency Injection
// should not be reimported in any other files !
import 'reflect-metadata';

import fws from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { REDIS_CONNECTION } from './config/redis';
import { registerDependencies } from './di/container';
import databasePlugin from './plugins/database';
import metaPlugin from './plugins/meta';
import swaggerPlugin from './plugins/swagger';
import { schemaRegisterPlugin } from './plugins/typebox';
import authPlugin from './services/auth';
import { plugin as passportPlugin } from './services/auth/plugins/passport';
import ItemServiceApi from './services/item';
import { maintenancePlugin } from './services/maintenance/maintenance.controller';
import MemberServiceApi from './services/member';
import tagPlugin from './services/tag/tag.controller';
import websocketsPlugin from './services/websockets/websocket.controller';

export default async function (instance: FastifyInstance): Promise<void> {
  const { log } = instance;

  await instance.register(fws, {
    errorHandler: (error, conn, _req, _reply) => {
      log.error(
        `graasp-websockets: an error occured: ${error.toString()}\n\tDestroying connection`,
      );
      conn.terminate();
    },
  });

  await instance
    .register(fp(swaggerPlugin))
    .register(fp(schemaRegisterPlugin))

    // db should be registered before the dependencies.
    .register(fp(databasePlugin));

  // register some dependencies manually
  registerDependencies(instance.log);
  await instance.register(metaPlugin);

  await instance.register(fp(passportPlugin));

  await instance.register(
    async (instance) => {
      // need to be defined before member and item for auth check
      await instance.register(fp(authPlugin));
      // core API modules
      await instance
        // the websockets plugin must be registered before but in the same scope as the apis
        // otherwise tests somehow bypass mocking the authentication through jest.spyOn(app, 'verifyAuthentication')
        .register(fp(websocketsPlugin), {
          prefix: '/ws',
          redis: {
            channelName: 'graasp-realtime-updates',
            connection: REDIS_CONNECTION,
          },
        })
        .register(fp(MemberServiceApi))
        .register(fp(ItemServiceApi))
        .register(tagPlugin)
        .register(maintenancePlugin);
    },
    { prefix: '/api' },
  );
}
