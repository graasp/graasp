import fastify, { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import {
  ENVIRONMENT,
  PG_CONNECTION_URI, DATABASE_LOGS, DISABLE_LOGS,
  MAILER_CONFIG_SMTP_HOST,
  MAILER_CONFIG_USERNAME,
  MAILER_CONFIG_PASSWORD,
  MAILER_CONFIG_FROM_EMAIL
} from './util/config';
import globalDefinitions from './schemas/global';

import databasePlugin from './plugins/database';
import authPlugin from './plugins/auth/auth';
import mailerPlugin from 'graasp-mailer';

import { ItemService } from './services/items/db-service';
import { ItemMembershipService } from './services/item-memberships/db-service';
import { MemberService } from './services/members/db-service';
import ItemsServiceApi from './services/items/service-api';
import ItemMembershipsServiceApi from './services/item-memberships/service-api';
import MemberServiceApi from './services/members/service-api';
import { GlobalTaskRunner } from './services/global-task-runner';

const decorateFastifyInstance: FastifyPluginAsync = async (fastify) => {
  const { db, log } = fastify;
  fastify.decorate('taskRunner', new GlobalTaskRunner(db, log));

  fastify.decorate('members', { dbService: new MemberService(), taskManager: null });
  fastify.decorate('items', { dbService: new ItemService(), taskManager: null });
  fastify.decorate('itemMemberships', { dbService: new ItemMembershipService(), taskManager: null });

  fastify.decorateRequest('member', null);
};

const instance = fastify({ logger: !DISABLE_LOGS });
// const instance = fastify({ logger: { prettyPrint: true, level: 'debug' } });

// load global schema definitions
instance.addSchema(globalDefinitions);

instance
  .register(fp(databasePlugin), { uri: PG_CONNECTION_URI, logs: DATABASE_LOGS })
  .register(fp(decorateFastifyInstance))
  .register(mailerPlugin, {
    host: MAILER_CONFIG_SMTP_HOST,
    username: MAILER_CONFIG_USERNAME,
    password: MAILER_CONFIG_PASSWORD,
    fromEmail: MAILER_CONFIG_FROM_EMAIL
  })
  .register(authPlugin, { sessionCookieDomain: (ENVIRONMENT === 'staging' ? 'ielsrv7.epfl.ch' : null) });

instance.register(async (instance) => {
  // core API modules
  instance
    .register(fp(MemberServiceApi))
    .register(fp(ItemsServiceApi))
    .register(fp(ItemMembershipsServiceApi));
});

// TODO: set fastify 'on close' handler, and disconnect from services there: db, ...
export default instance;
