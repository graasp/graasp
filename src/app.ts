import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import {
  COOKIE_DOMAIN,
  PG_CONNECTION_URI, DATABASE_LOGS, MAILER_CONFIG_SMTP_HOST,
  MAILER_CONFIG_USERNAME,
  MAILER_CONFIG_PASSWORD,
  MAILER_CONFIG_FROM_EMAIL,
  WEBSOCKETS_PLUGIN,
  REDIS_HOST,
  REDIS_PORT,
  REDIS_USERNAME,
  REDIS_PASSWORD
} from './util/config';
import shared from './schemas/fluent-schema';

import databasePlugin from './plugins/database';
import authPlugin from './plugins/auth/auth';
import metaPlugin from './plugins/meta';
import mailerPlugin from 'graasp-mailer';
import graaspWebSockets from 'graasp-websockets';

import { ItemService } from './services/items/db-service';
import { ItemMembershipService } from './services/item-memberships/db-service';
import { MemberService } from './services/members/db-service';
import { GroupMembershipService } from './services/group-memberships/db-service';
import ItemsServiceApi from './services/items/service-api';
import ItemMembershipsServiceApi from './services/item-memberships/service-api';
import MemberServiceApi from './services/members/service-api';
import GroupServiceApi from './services/groups/service-api';
import GroupMembershipsServiceApi from './services/group-memberships/service-api';
import { GlobalTaskRunner } from './services/global-task-runner';
import {GroupService} from './services/groups/db-service';

const decorateFastifyInstance: FastifyPluginAsync = async (fastify) => {
  const { db, log } = fastify;
  fastify.decorate('taskRunner', new GlobalTaskRunner(db, log));
  fastify.decorate('members', { dbService: new MemberService(), taskManager: null });
  fastify.decorate('groups', { dbService: new GroupService(),taskManager: null });
  fastify.decorate('items', { dbService: new ItemService(), taskManager: null });
  fastify.decorate('groupMemberships', { dbService: new GroupMembershipService(), taskManager: null });
  fastify.decorate('itemMemberships', { dbService: new ItemMembershipService(), taskManager: null });
  fastify.decorateRequest('member', null);
};

export default async function (instance: FastifyInstance): Promise<void> {
  // load some shared schema definitions
  instance.addSchema(shared);

  instance
    .register(fp(databasePlugin), { uri: PG_CONNECTION_URI, logs: DATABASE_LOGS })
    .register(fp(decorateFastifyInstance))
    .register(metaPlugin)
    .register(mailerPlugin, {
      host: MAILER_CONFIG_SMTP_HOST,
      username: MAILER_CONFIG_USERNAME,
      password: MAILER_CONFIG_PASSWORD,
      fromEmail: MAILER_CONFIG_FROM_EMAIL
    });

  await instance.register(authPlugin, { sessionCookieDomain: COOKIE_DOMAIN ?? null });

  instance.register(async (instance) => {
    // core API modules
    instance
      .register(fp(MemberServiceApi))
      .register(fp(ItemMembershipsServiceApi))
      .register(fp(GroupServiceApi))
      .register(fp(ItemsServiceApi))
      .register(fp(GroupMembershipsServiceApi));

    if (WEBSOCKETS_PLUGIN) {
      instance.register(graaspWebSockets, {
        prefix: '/ws',
        redis: {
          config: {
            host: REDIS_HOST,
            port: +REDIS_PORT,
            username: REDIS_USERNAME,
            password: REDIS_PASSWORD,
          }
        }
      });
    }
  });
}

// TODO: set fastify 'on close' handler, and disconnect from services there: db, ...
