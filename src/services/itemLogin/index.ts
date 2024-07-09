import { FastifyPluginAsync } from 'fastify';

import { ItemLoginSchemaType } from '@graasp/sdk';

import { resolveDependency } from '../../di/utils';
import { buildRepositories } from '../../utils/repositories';
import { SESSION_KEY, isAuthenticated, optionalIsAuthenticated } from '../auth/plugins/passport';
import { ItemService } from '../item/service';
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
  const { db } = fastify;

  const itemService = resolveDependency(ItemService);
  const itemLoginService = new ItemLoginService(fastify, itemService);

  // get login schema type for item
  // used to trigger item login for student
  // public endpoint
  fastify.get<{ Params: { id: string } }>(
    '/:id/login-schema-type',
    { schema: getLoginSchemaType, preHandler: optionalIsAuthenticated },
    async ({ user, params: { id: itemId } }) => {
      const value =
        (await itemLoginService.getSchemaType(user?.member, buildRepositories(), itemId)) ?? null;
      return value;
    },
  );

  // get login schema for item
  fastify.get<{ Params: { id: string } }>(
    '/:id/login-schema',
    {
      schema: getLoginSchema,
      preHandler: isAuthenticated,
    },
    async ({ user, params: { id: itemId } }) => {
      const value = (await itemLoginService.get(user?.member, buildRepositories(), itemId)) ?? {};
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
      preHandler: optionalIsAuthenticated,
    },
    async ({ body, user, session, params }) => {
      return db.transaction(async (manager) => {
        const bondMember = await itemLoginService.login(
          user?.member,
          buildRepositories(manager),
          params.id,
          body,
        );
        // set session
        session.set(SESSION_KEY, bondMember.id);
        return bondMember;
      });
    },
  );

  fastify.put<{ Params: { id: string }; Body: { type: ItemLoginSchemaType } }>(
    '/:id/login-schema',
    {
      schema: updateLoginSchema,

      // set member in request - throws if does not exist
      preHandler: isAuthenticated,
    },
    async ({ user, params: { id: itemId }, body: { type } }) => {
      return db.transaction(async (manager) => {
        return itemLoginService.put(user?.member, buildRepositories(manager), itemId, type);
      });
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/:id/login-schema',
    {
      schema: deleteLoginSchema,

      // set member in request - throws if does not exist
      preHandler: isAuthenticated,
    },
    async ({ user, params: { id: itemId } }) => {
      return db.transaction(async (manager) => {
        return itemLoginService.delete(user?.member, buildRepositories(manager), itemId);
      });
    },
  );
};

export default plugin;
