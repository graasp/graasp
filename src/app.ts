// needed to use decorators for Dependency Injection
// should not be reimported in any other files !
import 'reflect-metadata';

import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { registerDependencies } from './di/container';
import databasePlugin from './plugins/database';
import metaPlugin from './plugins/meta';
import swaggerPlugin from './plugins/swagger';
import { schemaRegisterPlugin } from './plugins/typebox';
import authPlugin from './services/auth';
import { plugin as passportPlugin } from './services/auth/plugins/passport';
import ItemServiceApi from './services/item';
import ItemMembershipServiceApi from './services/itemMembership/membership.controller';
import MemberServiceApi from './services/member';
import tagPlugin from './services/tag/controller';
import websocketsPlugin from './services/websockets';
import { REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, REDIS_USERNAME } from './utils/config';

export default async function (instance: FastifyInstance): Promise<void> {
  await instance
    .register(fp(swaggerPlugin))
    .register(fp(schemaRegisterPlugin))

    // db should be registered before the dependencies.
    .register(fp(databasePlugin));

  // register some dependencies manually
  registerDependencies(instance);

  await instance.register(fp(metaPlugin));

  await instance.register(fp(passportPlugin));
  // need to be defined before member and item for auth check

  await instance.register(fp(authPlugin));

  await instance.register(async (instance) => {
    // core API modules
    await instance
      // the websockets plugin must be registered before but in the same scope as the apis
      // otherwise tests somehow bypass mocking the authentication through jest.spyOn(app, 'verifyAuthentication')
      .register(fp(websocketsPlugin), {
        prefix: '/ws',
        redis: {
          channelName: 'graasp-realtime-updates',
          config: {
            host: REDIS_HOST,
            port: REDIS_PORT,
            username: REDIS_USERNAME,
            password: REDIS_PASSWORD,
          },
        },
      })
      .register(fp(MemberServiceApi))
      .register(fp(ItemServiceApi))
      .register(fp(ItemMembershipServiceApi))
      .register(tagPlugin);
  });
}

// TODO: set fastify 'on close' handler, and disconnect from services there: db, ...
