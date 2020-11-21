import fastify, { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import {
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
import { Member } from './services/members/interfaces/member';

async function decorateFastifyInstance(fastify: FastifyInstance) {
  fastify.decorateRequest('member', null);

  fastify.decorate('memberService', new MemberService());
  fastify.decorate('itemService', new ItemService());
  fastify.decorate('itemMembershipService', new ItemMembershipService());
}

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
  .register(authPlugin);

instance.register(async (instance) => {
  // authPlugin's session validation (only in this scope)
  instance.addHook('preHandler', instance.validateSession);

  // API modules
  instance
    .register(ItemsServiceApi, { prefix: '/items' })
    .register(ItemMembershipsServiceApi, { prefix: '/item-memberships' })
    .register(MemberServiceApi, { prefix: '/members' });
});

// TODO: set fastify 'on close' handler, and disconnect from services there: db, ...
export default instance;
