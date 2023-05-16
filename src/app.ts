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
import {
  CLIENT_HOSTS,
  COOKIE_DOMAIN,
  DATABASE_LOGS,
  FILE_ITEM_PLUGIN_OPTIONS,
  FILE_ITEM_TYPE,
  MAILER_CONFIG_FROM_EMAIL,
  MAILER_CONFIG_PASSWORD,
  MAILER_CONFIG_SMTP_HOST,
  MAILER_CONFIG_USERNAME,
  S3_FILE_ITEM_PLUGIN_OPTIONS,
} from './utils/config';

export default async function (instance: FastifyInstance): Promise<void> {
  instance.decorate('hosts', CLIENT_HOSTS);

  // load some shared schema definitions
  instance.addSchema(shared);

  instance
    .register(fp(metaPlugin))
    .register(fp(databasePlugin), {
      logs: DATABASE_LOGS,
    })
    .register(fp(decoratorPlugin))
    .register(mailerPlugin, {
      host: MAILER_CONFIG_SMTP_HOST,
      username: MAILER_CONFIG_USERNAME,
      password: MAILER_CONFIG_PASSWORD,
      fromEmail: MAILER_CONFIG_FROM_EMAIL,
    });

  // need to be defined before member and item for auth check
  await instance.register(fp(authPlugin), { sessionCookieDomain: COOKIE_DOMAIN });

  // file
  await instance.register(fp(filePlugin), {
    fileItemType: FILE_ITEM_TYPE,
    fileConfigurations: {
      s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
      local: FILE_ITEM_PLUGIN_OPTIONS,
    },
  });

  // if (WEBSOCKETS_PLUGIN) {
  //   await instance.register(graaspWebSockets, {
  //     prefix: '/ws',
  //     redis: {
  //       config: {
  //         host: REDIS_HOST,
  //         port: +REDIS_PORT,
  //         username: REDIS_USERNAME,
  //         password: REDIS_PASSWORD,
  //       },
  //     },
  //   });
  // }

  instance.register(async (instance) => {
    // core API modules
    await instance
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
    //       hosts: CLIENT_HOSTS,
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
