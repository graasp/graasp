import fastify, { FastifyInstance } from 'fastify';
import fastifyBasicAuth from 'fastify-basic-auth';
import fp from 'fastify-plugin';
import { PG_CONNECTION_URI, DATABASE_LOGS, DISABLE_LOGS } from 'util/config';
import globalDefinitions from 'schemas/global';

import DatabasePlugin from 'plugins/database';
import { ItemService } from 'services/items/db-service';
import { ItemMembershipService } from 'services/item-memberships/db-service';
import { MemberService } from 'services/members/db-service';

import ItemsServiceApi from 'services/items/service-api';
import ItemMembershipsServiceApi from 'services/item-memberships/service-api';
import MemberServiceApi from 'services/members/service-api';

async function decorateFastifyInstance(fastify: FastifyInstance) {
  fastify.decorateRequest('member', null);

  fastify.decorate('memberService', new MemberService());
  fastify.decorate('itemService', new ItemService());
  fastify.decorate('itemMembershipService', new ItemMembershipService());
}

// const instance = fastify({ logger: { prettyPrint: true } });
const instance = fastify({ logger: !DISABLE_LOGS });

// load global schema definitions
instance.addSchema(globalDefinitions);

instance
  .register(fp(DatabasePlugin), { uri: PG_CONNECTION_URI, logs: DATABASE_LOGS })
  .register(fp(decorateFastifyInstance));

instance
  .register(fastifyBasicAuth, {
    authenticate: true,
    validate: async (username, password, request) => {
      const { db, memberService: mS } = instance;
      const member = await mS.getMatchingName(username, db.pool);
      if (!member) throw new Error('Member not found');
      request.member = member;
    }
  })
  .after(() => {
    instance.addHook('preHandler', instance.basicAuth);
  });

instance
  // API modules
  .register(ItemsServiceApi, { prefix: '/items' })
  .register(ItemMembershipsServiceApi, { prefix: '/item-memberships' })
  .register(MemberServiceApi, { prefix: '/members' });

// TODO: set fastify 'on close' handler, and disconnect from services there: db, ...

export default instance;
