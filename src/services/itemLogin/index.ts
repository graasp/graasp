import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ItemLoginSchemaStatus, PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../di/utils.js';
import { db } from '../../drizzle/db.js';
import { asDefined } from '../../utils/assertions.js';
import { ItemNotFound } from '../../utils/errors.js';
import {
  SESSION_KEY,
  isAuthenticated,
  matchOne,
  optionalIsAuthenticated,
} from '../auth/plugins/passport/index.js';
import { assertIsMember } from '../authentication.js';
import { AuthorizationService } from '../authorization.js';
import { BasicItemService } from '../item/basic.service.js';
import { ItemRepository } from '../item/repository.js';
import { ItemService } from '../item/service.js';
import { validatedMemberAccountRole } from '../member/strategies/validatedMemberAccountRole.js';
import { ItemLoginSchemaNotFound, ValidMemberSession } from './errors.js';
import {
  deleteLoginSchema,
  getItemLoginSchema,
  getLoginSchemaType,
  loginOrRegisterAsGuest,
  updateLoginSchema,
} from './schemas.js';
import { ItemLoginService } from './service.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const itemLoginService = resolveDependency(ItemLoginService);
  const basicItemService = resolveDependency(BasicItemService);
  const itemRepository = resolveDependency(ItemRepository);
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
        const item = await itemRepository.getOne(tx, itemId);
        if (!item) {
          throw new ItemNotFound(itemId);
        }
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
        const item = await basicItemService.get(tx, user?.account, itemId, PermissionLevel.Admin);
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
      return await db.transaction(async (tx) => {
        const item = await basicItemService.get(tx, member, itemId, PermissionLevel.Admin); // Validate permissions

        await itemLoginService.updateOrCreate(tx, item.path, type, status);
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
          await basicItemService.get(tx, member, itemId, PermissionLevel.Admin);

          const { id } = await itemLoginService.delete(tx, itemId);
          return id;
        } catch (e: unknown) {
          throw new ItemLoginSchemaNotFound({ itemId });
        }
      });
    },
  );
};

export default plugin;
