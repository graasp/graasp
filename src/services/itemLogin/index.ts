import { FastifyPluginAsync } from 'fastify';

import { ItemLoginSchemaType } from '@graasp/sdk';

import { buildRepositories } from '../../utils/repositories';
import { ItemLoginMemberCredentials } from './interfaces/item-login';
import {
  deleteLoginSchema,
  getLoginSchema,
  getLoginSchemaType,
  login,
  updateLoginSchema,
} from './schemas';
import { ItemLoginService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, items } = fastify;

  const iLService = new ItemLoginService(fastify, items.service);

  // get login schema type for item
  // used to trigger item login for student
  // public endpoint
  fastify.get<{ Params: { id: string } }>(
    '/:id/login-schema-type',
    { schema: getLoginSchemaType, preHandler: fastify.attemptVerifyAuthentication },
    async ({ member, params: { id: itemId } }) => {
      const value = (await iLService.getSchemaType(member, buildRepositories(), itemId)) ?? null;
      return value;
    },
  );

  // get login schema for item
  fastify.get<{ Params: { id: string } }>(
    '/:id/login-schema',
    {
      schema: getLoginSchema,
      preHandler: fastify.verifyAuthentication,
    },
    async ({ member, params: { id: itemId } }) => {
      const value = (await iLService.get(member, buildRepositories(), itemId)) ?? {};
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
      preHandler: fastify.attemptVerifyAuthentication,
    },
    async ({ body, member, session, params }) => {
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
    async ({ member, params: { id: itemId }, body: { type } }) => {
      return db.transaction(async (manager) => {
        return iLService.put(member, buildRepositories(manager), itemId, type);
      });
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/:id/login-schema',
    {
      schema: deleteLoginSchema,

      // set member in request - throws if does not exist
      preHandler: fastify.verifyAuthentication,
    },
    async ({ member, params: { id: itemId } }) => {
      return db.transaction(async (manager) => {
        return iLService.delete(member, buildRepositories(manager), itemId);
      });
    },
  );
};

export default plugin;
