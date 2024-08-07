// needed to use decorators for Dependency Injection
// should not be reimported in any other files !
import 'reflect-metadata';

import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { registerDependencies } from './di/container';
import databasePlugin from './plugins/database';
import metaPlugin from './plugins/meta';
import swaggerPlugin from './plugins/swagger';
import shared from './schemas/fluent-schema';
import authPlugin from './services/auth';
import { plugin as passportPlugin } from './services/auth/plugins/passport';
import ItemServiceApi from './services/item';
import ItemMembershipServiceApi from './services/itemMembership';
import MemberServiceApi from './services/member';
import websocketsPlugin from './services/websockets';
import {
  DATABASE_LOGS,
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_USERNAME,
} from './utils/config';

export default async function (instance: FastifyInstance): Promise<void> {
  await instance.register(fp(swaggerPlugin));

  // load some shared schema definitions
  instance.addSchema(shared);

  // db should be registered before the dependencies.
  await instance.register(fp(databasePlugin), {
    logs: DATABASE_LOGS,
  });

  // register some dependencies manually
  registerDependencies(instance);

  await instance
    .register(fp(metaPlugin))
    .register(fp(passportPlugin))
    // need to be defined before member and item for auth check
    .register(fp(authPlugin));

  instance.register(async (instance) => {
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
      .register(fp(ItemMembershipServiceApi));

    // instance.register(
    //   async (instance) => {
    //     // add CORS support
    //     if (instance.corsPluginOptions) {
    //       instance.register(fastifyCors, instance.corsPluginOptions);
    //     }
    //     instance.addHook('preHandler', instance.verifyAuthentication);
    //     instance.register(graaspPluginActions, {
    //       shouldSave: SAVE_ACTIONS,
    //       fileItemType: FILE_ITEM_TYPE,
    //       fileConfigurations: {
    //         s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
    //         local: FILE_ITEM_PLUGIN_OPTIONS,
    //       },
    //     });
    //   },
    //   { prefix: '/analytics' },
    // );
  });
}

// TODO: set fastify 'on close' handler, and disconnect from services there: db, ...
