import { FastifyPluginAsync } from 'fastify';

import { Actor, ItemLoginSchemaType } from '@graasp/sdk';

import { buildRepositories } from '../../util/repositories';
import { Member } from '../member/entities/member';
import { ItemLoginMemberCredentials } from './interfaces/item-login';
import { credentials, getLoginSchema, getLoginSchemaType, login, updateLoginSchema } from './schemas/schemas';
import { ItemLoginService } from './service';

export interface GraaspItemLoginOptions {
  /** id of the tag to look for in the item to allow the "log in" to item */
  tagId: string;
  graaspActor: Actor;
}

const plugin: FastifyPluginAsync<GraaspItemLoginOptions> = async (fastify, options) => {
  const { db } = fastify;

  const iLService = new ItemLoginService(fastify);

  // get login schema type for item
  // used to trigger item login for student
  // public endpoint
  fastify.get<{ Params: { id: string } }>(
    '/:id/login-schema-type',
    { schema: getLoginSchemaType },
    async ({ log, params: { id: itemId } }) => {
      
      const value = await iLService.getSchemaType(null, buildRepositories(), itemId) ?? null;
      return value; },
  );

  // get login schema for item
  fastify.get<{ Params: { id: string } }>(
    '/:id/login-schema',
    { 
      schema: getLoginSchema ,
      preHandler: fastify.verifyAuthentication,
    },
    async ({ member, params: { id: itemId } }) => {
      const value = await iLService.get(member, buildRepositories(), itemId) ?? {};
    return value;
    },
  );

  // TODO: MOBILE
  // log in to item
  fastify.post<{
    Params: { id: string };
    Querystring: { m: boolean };
    Body: ItemLoginMemberCredentials;
  }>(
    '/:id/login',
    {
      schema: login,
      // set member in request if exists without throwing
      preHandler: async (request) => {
        await fastify.fetchMemberInSession(request);
      },
    },
    async ({ body, query, member, session, params }) => {
      return db.transaction(async (manager) => {
        const bondMember = await iLService.login(
          member,
          buildRepositories(manager),
          params.id,
          body,
        );
        // set session
        session.set('member', bondMember.id);
        return bondMember;
      });
    },
  );

  fastify.put<{ Params: { id: string }; Body: { type: ItemLoginSchemaType } }>(
    '/:id/login-schema',
    {
      schema: updateLoginSchema,

      // set member in request - throws if does not exist
      preHandler: fastify.verifyAuthentication,
    },
    async ({ log, member, params: { id: itemId }, body: { type } }) => {
      return db.transaction(async (manager) => {
        return iLService.put(member, buildRepositories(manager), itemId, type);
      });
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/:id/login-schema',
    {
      // schema: updateLoginSchema,

      // set member in request - throws if does not exist
      preHandler: fastify.verifyAuthentication,
    },
    async ({ log, member, params: { id: itemId } }) => {
      return db.transaction(async (manager) => {
        return iLService.delete(member, buildRepositories(manager), itemId);
      });
    },
  );
};

export default plugin;
