import { FastifyPluginAsync } from 'fastify';

import { ItemLoginSchemaType, PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../di/utils';
import { EntryNotFoundBeforeDeleteException } from '../../repositories/errors';
import { asDefined } from '../../utils/assertions';
import { buildRepositories } from '../../utils/repositories';
import { SESSION_KEY, isAuthenticated, optionalIsAuthenticated } from '../auth/plugins/passport';
import { matchOne } from '../authorization';
import { ItemService } from '../item/service';
import { assertIsMember } from '../member/entities/member';
import { validatedMemberAccountRole } from '../member/strategies/validatedMemberAccountRole';
import { ItemLoginSchemaNotFound, ValidMemberSession } from './errors';
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
        (await itemLoginService.getSchemaType(user?.account, buildRepositories(), itemId)) ?? null;
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
      const value = (await itemLoginService.get(user?.account, buildRepositories(), itemId)) ?? {};
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
      // if there's already a valid session, fail immediately
      if (user?.account) {
        throw new ValidMemberSession(user?.account);
      }
      return db.transaction(async (manager) => {
        const bondMember = await itemLoginService.login(
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
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params: { id: itemId }, body: { type } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        const item = await itemService.get(member, repositories, itemId, PermissionLevel.Admin); // Validate permissions
        const schema = await itemLoginService.getOneByItem(repositories, item.id);
        if (schema) {
          // If exists, then update the existing one
          return await itemLoginService.update(
            repositories,
            schema.id,
            type ?? ItemLoginSchemaType.Username,
          );
        } else {
          // If not exists, then create a new one
          return await itemLoginService.create(repositories, item.path, type);
        }
      });
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/:id/login-schema',
    {
      schema: deleteLoginSchema,

      // set member in request - throws if does not exist
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params: { id: itemId } }) => {
      return db.transaction(async (manager) => {
        const member = asDefined(user?.account);
        assertIsMember(member);
        try {
          return (await itemLoginService.delete(member, buildRepositories(manager), itemId)).id;
        } catch (e: unknown) {
          if (e instanceof EntryNotFoundBeforeDeleteException) {
            throw new ItemLoginSchemaNotFound({ itemId });
          }
        }
      });
    },
  );
};

export default plugin;
