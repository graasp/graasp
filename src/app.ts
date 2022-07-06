import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';
import publicPlugin from './plugins/public';
import graaspPluginActions from 'graasp-plugin-actions';

import {
  COOKIE_DOMAIN,
  PG_CONNECTION_URI,
  DATABASE_LOGS,
  MAILER_CONFIG_SMTP_HOST,
  MAILER_CONFIG_USERNAME,
  MAILER_CONFIG_PASSWORD,
  MAILER_CONFIG_FROM_EMAIL,
  WEBSOCKETS_PLUGIN,
  REDIS_HOST,
  REDIS_PORT,
  REDIS_USERNAME,
  REDIS_PASSWORD,
  PUBLIC_PLUGIN,
  GRAASP_ACTOR,
  SAVE_ACTIONS,
  CLIENT_HOSTS,
  SERVICE_METHOD,
  S3_FILE_ITEM_PLUGIN_OPTIONS,
  FILE_ITEM_PLUGIN_OPTIONS,
} from './util/config';
import shared from './schemas/fluent-schema';

import databasePlugin from './plugins/database';
import authPlugin from './plugins/auth/auth';
import metaPlugin from './plugins/meta';
import mailerPlugin from 'graasp-mailer';
import graaspWebSockets from 'graasp-websockets';

import ItemsServiceApi from './services/items/service-api';
import ItemMembershipsServiceApi from './services/item-memberships/service-api';
import MemberServiceApi from './services/members/service-api';
import decoratorPlugin from './plugins/decorator';

export default async function (instance: FastifyInstance): Promise<void> {
  // load some shared schema definitions
  instance.addSchema(shared);

  instance
    .register(fp(databasePlugin), { uri: PG_CONNECTION_URI, logs: DATABASE_LOGS })
    .register(fp(decoratorPlugin))
    .register(metaPlugin)
    .register(mailerPlugin, {
      host: MAILER_CONFIG_SMTP_HOST,
      username: MAILER_CONFIG_USERNAME,
      password: MAILER_CONFIG_PASSWORD,
      fromEmail: MAILER_CONFIG_FROM_EMAIL,
    });

  await instance.register(fp(authPlugin), { sessionCookieDomain: COOKIE_DOMAIN ?? null });

  if (WEBSOCKETS_PLUGIN) {
    await instance.register(graaspWebSockets, {
      prefix: '/ws',
      redis: {
        config: {
          host: REDIS_HOST,
          port: +REDIS_PORT,
          username: REDIS_USERNAME,
          password: REDIS_PASSWORD,
        },
      },
    });
  }

  instance.register(async (instance) => {
    // core API modules
    await instance
      .register(fp(MemberServiceApi))
      .register(fp(ItemMembershipsServiceApi))
      .register(fp(ItemsServiceApi));

    if (PUBLIC_PLUGIN) {
      await instance.register(publicPlugin);
    }
  });

  instance.register(
    async (instance) => {
      // add CORS support
      if (instance.corsPluginOptions) {
        instance.register(fastifyCors, instance.corsPluginOptions);
      }
      instance.addHook('preHandler', instance.verifyAuthentication);
      instance.register(graaspPluginActions, {
        shouldSave: SAVE_ACTIONS,
        graaspActor: GRAASP_ACTOR,
        hosts: CLIENT_HOSTS,
        serviceMethod: SERVICE_METHOD,
        serviceOptions: {
          s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
          local: FILE_ITEM_PLUGIN_OPTIONS,
        },
      });
    },
    { prefix: '/analytics' },
  );
}

// TODO: set fastify 'on close' handler, and disconnect from services there: db, ...
