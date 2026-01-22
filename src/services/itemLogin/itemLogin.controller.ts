import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ItemLoginSchemaStatus } from '@graasp/sdk';

import { resolveDependency } from '../../di/utils';
import { db } from '../../drizzle/db';
import { asDefined } from '../../utils/assertions';
import { ItemNotFound } from '../../utils/errors';
import {
  SESSION_KEY,
  isAuthenticated,
  matchOne,
  optionalIsAuthenticated,
} from '../auth/plugins/passport';
import { assertIsMember } from '../authentication';
import { AuthorizedItemService } from '../authorizedItem.service';
import { ItemRepository } from '../item/item.repository';
import { validatedMemberAccountRole } from '../member/strategies/validatedMemberAccountRole';
import { ItemLoginSchemaNotFound, ValidMemberSession } from './errors';
import {
  deleteLoginSchema,
  getItemLoginSchema,
  getLoginSchemaType,
  loginOrRegisterAsGuest,
  updateLoginSchema,
} from './itemLogin.schemas';
import { ItemLoginService } from './itemLogin.service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const itemLoginService = resolveDependency(ItemLoginService);
  const itemRepository = resolveDependency(ItemRepository);
  const authorizedItemService = resolveDependency(AuthorizedItemService);

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
        const isVisible = await itemLoginService.isItemVisible(tx, user?.account, item.path);
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
    async ({ user, params: { id: itemId } }, reply) => {
      const item = await authorizedItemService.getItemById(db, {
        accountId: user?.account?.id,
        itemId,
        permission: 'admin',
      });
      const itemLoginSchema = await itemLoginService.getByItemPath(db, item.path);
      if (!itemLoginSchema) {
        reply.status(StatusCodes.NO_CONTENT);
      } else {
        return itemLoginSchema;
      }
    },
  );

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
    async ({ user, params: { id: itemId }, body: { type, status } }, reply) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      await db.transaction(async (tx) => {
        const item = await authorizedItemService.getItemById(tx, {
          accountId: member.id,
          itemId,
          permission: 'admin',
        });

        await itemLoginService.updateOrCreate(tx, item.path, type, status);
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/:id/login-schema',
    {
      schema: deleteLoginSchema,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params: { id: itemId }, log }, reply) => {
      const member = asDefined(user?.account);
      assertIsMember(member);

      return db.transaction(async (tx) => {
        // Validate permission
        await authorizedItemService.getItemById(tx, {
          accountId: member.id,
          itemId,
          permission: 'admin',
        });
        try {
          await itemLoginService.delete(tx, itemId);
          reply.status(StatusCodes.NO_CONTENT);
        } catch (e: unknown) {
          log.error(e);
          throw new ItemLoginSchemaNotFound({ itemId });
        }
      });
    },
  );
};

export default plugin;
