import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import databasePlugin from './plugins/database';
import decoratorPlugin from './plugins/decorator';
import mailerPlugin from './plugins/mailer';
import metaPlugin from './plugins/meta';
import shared from './schemas/fluent-schema';
import authPlugin from './services/auth';
import filePlugin from './services/file';
import ItemServiceApi from './services/item';
import ItemMembershipServiceApi from './services/itemMembership';
import MemberServiceApi from './services/member';
import websocketsPlugin from './services/websockets';
import {
  COOKIE_DOMAIN,
  DATABASE_LOGS,
  FILE_ITEM_PLUGIN_OPTIONS,
  FILE_ITEM_TYPE,
  MAILER_CONFIG_FROM_EMAIL,
  MAILER_CONFIG_PASSWORD,
  MAILER_CONFIG_SMTP_HOST,
  MAILER_CONFIG_SMTP_PORT,
  MAILER_CONFIG_SMTP_USE_SSL,
  MAILER_CONFIG_USERNAME,
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_USERNAME,
  S3_FILE_ITEM_PLUGIN_OPTIONS,
} from './utils/config';

export default async function (instance: FastifyInstance): Promise<void> {
  // load some shared schema definitions
  instance.addSchema(shared);
  // file
  await instance.register(fp(filePlugin), {
    fileItemType: FILE_ITEM_TYPE,
    fileConfigurations: {
      s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
      local: FILE_ITEM_PLUGIN_OPTIONS,
    },
  });

  await instance
    .register(fp(metaPlugin))
    .register(fp(databasePlugin), {
      logs: DATABASE_LOGS,
    })
    .register(mailerPlugin, {
      host: MAILER_CONFIG_SMTP_HOST,
      port: MAILER_CONFIG_SMTP_PORT,
      useSsl: MAILER_CONFIG_SMTP_USE_SSL,
      username: MAILER_CONFIG_USERNAME,
      password: MAILER_CONFIG_PASSWORD,
      fromEmail: MAILER_CONFIG_FROM_EMAIL,
    })
    .register(fp(decoratorPlugin))
    // need to be defined before member and item for auth check
    .register(fp(authPlugin), { sessionCookieDomain: COOKIE_DOMAIN });

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
            port: parseInt(REDIS_PORT ?? '6379'),
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
