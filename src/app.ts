import fastifyCors from '@fastify/cors';
import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import mailerPlugin from 'graasp-mailer';
import graaspPluginActions from 'graasp-plugin-actions';
import graaspWebSockets from 'graasp-websockets';

import authPlugin from './plugins/auth/auth';
import databasePlugin from './plugins/database';
import decoratorPlugin from './plugins/decorator';
import metaPlugin from './plugins/meta';
import publicPlugin from './plugins/public';
import shared from './schemas/fluent-schema';
import ItemMembershipsServiceApi from './services/item-memberships/service-api';
import ItemsServiceApi from './services/items/service-api';
import MemberServiceApi from './services/members/service-api';
import {
  CLIENT_HOSTS,
  COOKIE_DOMAIN,
  DATABASE_LOGS,
  FILE_ITEM_PLUGIN_OPTIONS,
  FILE_ITEM_TYPE,
  GRAASP_ACTOR,
  MAILER_CONFIG_FROM_EMAIL,
  MAILER_CONFIG_PASSWORD,
  MAILER_CONFIG_SMTP_HOST,
  MAILER_CONFIG_USERNAME,
  PG_CONNECTION_URI,
  PG_READ_REPLICAS_CONNECTION_URIS,
  PUBLIC_PLUGIN,
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_USERNAME,
  S3_FILE_ITEM_PLUGIN_OPTIONS,
  SAVE_ACTIONS,
  WEBSOCKETS_PLUGIN,
} from './util/config';

export default async function (instance: FastifyInstance): Promise<void> {
  // load some shared schema definitions
  instance.addSchema(shared);

  instance
    .register(fp(databasePlugin), {
      uri: PG_CONNECTION_URI,
      readReplicaUris: PG_READ_REPLICAS_CONNECTION_URIS,
      logs: DATABASE_LOGS,
    })
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
        fileItemType: FILE_ITEM_TYPE,
        fileConfigurations: {
          s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
          local: FILE_ITEM_PLUGIN_OPTIONS,
        },
      });
    },
    { prefix: '/analytics' },
  );
}

// TODO: set fastify 'on close' handler, and disconnect from services there: db, ...
