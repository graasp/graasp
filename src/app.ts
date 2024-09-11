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
import accountPlugin from './services/account';
import authPlugin from './services/auth';
import { plugin as passportPlugin } from './services/auth/plugins/passport';
import ItemServiceApi from './services/item';
import ItemMembershipServiceApi from './services/itemMembership';
import MemberServiceApi from './services/member';
// import websocketsPlugin from './services/websockets';
import {
  DATABASE_LOGS,
  /* REDIS_HOST,
REDIS_PASSWORD,
REDIS_PORT,
REDIS_USERNAME, */
} from './utils/config';

export default async function (instance: FastifyInstance): Promise<void> {
  console.log('Inside app.ts');
  await instance.register(fp(swaggerPlugin));
  console.log('Register Swagger');

  // load some shared schema definitions
  instance.addSchema(shared);
  console.log('Add Schema');

  // db should be registered before the dependencies.
  await instance.register(fp(databasePlugin), {
    logs: DATABASE_LOGS,
  });
  console.log('Register DB');

  // register some dependencies manually
  registerDependencies(instance);
  console.log('Dependencies Registered');

  await instance
    .register(fp(metaPlugin))
    .register(fp(passportPlugin))
    // need to be defined before member and item for auth check
    .register(fp(authPlugin));

  console.log('Passport Auth Registered');

  instance.register(async (instance) => {
    // core API modules
    await instance
      // the websockets plugin must be registered before but in the same scope as the apis
      // otherwise tests somehow bypass mocking the authentication through jest.spyOn(app, 'verifyAuthentication')
      /* .register(fp(websocketsPlugin), {
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
      })*/
      .register(fp(accountPlugin))
      .register(fp(MemberServiceApi))
      .register(fp(ItemServiceApi))
      .register(fp(ItemMembershipServiceApi));

    console.log('Redis Registered');

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
