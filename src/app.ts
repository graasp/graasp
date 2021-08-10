import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import graaspPluginPublic from 'graasp-plugin-public';

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
  S3_FILE_ITEM_PLUGIN,
  GRAASP_ACTOR,
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
    await instance.register(graaspPluginPublic, {
      tagId: 'afc2efc2-525e-4692-915f-9ba06a7f7887', // TODO: get from config
      graaspActor: GRAASP_ACTOR,
      enableS3FileItemPlugin: S3_FILE_ITEM_PLUGIN,
      // native fastify option
      prefix: '/p',
    });
  }
  });
}

// TODO: set fastify 'on close' handler, and disconnect from services there: db, ...
