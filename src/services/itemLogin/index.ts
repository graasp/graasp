import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ItemLoginSchemaStatus, PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../di/utils';
import { db } from '../../drizzle/db';
import { EntryNotFoundBeforeDeleteException } from '../../repositories/errors';
import { asDefined } from '../../utils/assertions';
import { ItemNotFound } from '../../utils/errors';
import { SESSION_KEY, isAuthenticated, optionalIsAuthenticated } from '../auth/plugins/passport';
import { AuthorizationService, matchOne } from '../authorization';
import { ItemService } from '../item/service';
import { assertIsMember } from '../member/entities/member';
import { validatedMemberAccountRole } from '../member/strategies/validatedMemberAccountRole';
import { ItemLoginSchemaNotFound, ValidMemberSession } from './errors';
import {
  deleteLoginSchema,
  getItemLoginSchema,
  getLoginSchemaType,
  loginOrRegisterAsGuest,
  updateLoginSchema,
} from './schemas';
import { ItemLoginService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const itemLoginService = resolveDependency(ItemLoginService);
  const itemService = resolveDependency(ItemService);
  const authorizationService = resolveDependency(AuthorizationService);

  // get login schema type for item
  // used to trigger item login for student
  // public endpoint
  fastify.get(
    '/:id/login-schema-type',
    { schema: getLoginSchemaType, preHandler: optionalIsAuthenticated },
    async ({ user, params: { id: itemId } }) => {
      return await db.transaction(async (tx) => {
        // Get item to have the path
        const item = await this.itemRepository.getOneOrThrow(itemId);

        // If item is not visible, throw NOT_FOUND
        const isVisible = await authorizationService.isItemVisible(tx, user?.account, item.path);
        if (!isVisible) {
          throw new ItemNotFound(itemId);
        }
        const itemLoginSchema = await itemLoginService.getByItemPath(tx, item.path);
        if (itemLoginSchema && itemLoginSchema.status !== ItemLoginSchemaStatus.Disabled) {
          return itemLoginSchema.type;
        }
        return null;
      });
    },
  );

  // get login schema for item
  fastify.get(
    '/:id/login-schema',
    {
      schema: getItemLoginSchema,
      preHandler: isAuthenticated,
    },
    async ({ user, params: { id: itemId } }) => {
      return await db.transaction(async (tx) => {
        const item = await itemService.get(tx, user?.account, itemId, PermissionLevel.Admin);
        const itemLoginSchema = await itemLoginService.getByItemPath(tx, item.path);
        if (!itemLoginSchema) {
          throw new ItemLoginSchemaNotFound({ itemId });
        }
        return itemLoginSchema;
      });
    },
  );

  // TODO: MOBILE
  // log in to item
  fastify.post(
    '/:id/login',
    {
      schema: loginOrRegisterAsGuest,
      // set member in request if exists without throwing
      preHandler: optionalIsAuthenticated,
    },
    async ({ body, user, session, params }) => {
      // if there's already a valid session, fail immediately
      if (user?.account) {
        throw new ValidMemberSession(user?.account);
      }
      return db.transaction(async (tx) => {
        const bondMember = await itemLoginService.logInOrRegister(tx, params.id, body);
        // set session
        session.set(SESSION_KEY, bondMember.id);
        return bondMember;
      });
    },
  );

  fastify.put(
    '/:id/login-schema',
    {
      schema: updateLoginSchema,

      // set member in request - throws if does not exist
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params: { id: itemId }, body: { type, status } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return await db.transaction(async (manager) => {
        const item = await itemService.get(tx, member, itemId, PermissionLevel.Admin); // Validate permissions
        const schema = await itemLoginService.getOneByItem(tx, item.id);
        if (schema) {
          // If exists, then update the existing one
          return await itemLoginService.update(tx, schema.id, type, status);
        } else {
          // If not exists, then create a new one
          return await itemLoginService.create(tx, item.path, type);
        }
      });
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/:id/login-schema',
    {
      schema: deleteLoginSchema,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params: { id: itemId } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return db.transaction(async (tx) => {
        try {
          // Validate permission
          await itemService.get(tx, member, itemId, PermissionLevel.Admin);

          const { id } = await itemLoginService.delete(tx, member, itemId);
          return id;
        } catch (e: unknown) {
          if (e instanceof EntryNotFoundBeforeDeleteException) {
            throw new ItemLoginSchemaNotFound({ itemId });
          }
          throw e;
        }
      });
    },
  );
};

export default plugin;
