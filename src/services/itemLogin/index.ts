import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ItemLoginSchemaStatus, PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../di/utils';
import { asDefined } from '../../utils/assertions';
import { ItemNotFound } from '../../utils/errors';
import { buildRepositories } from '../../utils/repositories';
import { AccountService } from '../account/service';
import { SESSION_KEY, isAuthenticated, optionalIsAuthenticated } from '../auth/plugins/passport';
import { isItemVisible, matchOne } from '../authorization';
import { ItemTagService } from '../item/plugins/itemTag/service';
import { ItemService } from '../item/service';
import { ItemMembershipService } from '../itemMembership/service';
import { assertIsMember } from '../member/entities/member';
import { validatedMemberAccountRole } from '../member/strategies/validatedMemberAccountRole';
import { ItemLoginSchemaNotFound, ValidMemberSession } from './errors';
import { getLoginSchema, getLoginSchemaType, login, updateLoginSchema } from './schemas';
import { ItemLoginService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;

  const accountService = resolveDependency(AccountService);
  const itemLoginService = resolveDependency(ItemLoginService);
  const itemService = resolveDependency(ItemService);
  const itemTagService = resolveDependency(ItemTagService);
  const itemMembershipService = resolveDependency(ItemMembershipService);

  // get login schema type for item
  // used to trigger item login for student
  // public endpoint
  fastify.get(
    '/:id/login-schema-type',
    { schema: getLoginSchemaType, preHandler: optionalIsAuthenticated },
    async ({ user, params: { id: itemId } }) => {
      return await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        // Get item to have the path
        const item = await itemService.get(
          user?.account,
          repositories,
          itemId,
          PermissionLevel.Read,
          false,
        );

        // If item is not visible, throw NOT_FOUND
        const isVisible = await isItemVisible(
          user?.account,
          repositories,
          { itemTagService, itemMembershipService },
          item.path,
        );
        if (!isVisible) {
          throw new ItemNotFound(itemId);
        }
        const itemLoginSchema = await itemLoginService.getByItemPath(repositories, item.path);
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
      schema: getLoginSchema,
      preHandler: isAuthenticated,
    },
    async ({ user, params: { id: itemId } }) => {
      return await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const item = await itemService.get(
          user?.account,
          repositories,
          itemId,
          PermissionLevel.Admin,
        );
        const itemLoginSchema = await itemLoginService.getByItemPath(repositories, item.path);
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
        const repositories = buildRepositories(manager);
        const bondMember = await itemLoginService.logInOrRegister(repositories, params.id, body);
        // update last authenticated at
        await accountService.refreshLastAuthenticatedAt(bondMember.id, repositories);
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
        const repositories = buildRepositories(manager);

        const item = await itemService.get(member, repositories, itemId, PermissionLevel.Admin); // Validate permissions
        const schema = await itemLoginService.getOneByItem(repositories, item.id);
        if (schema) {
          // If exists, then update the existing one
          return await itemLoginService.update(repositories, schema.id, type, status);
        } else {
          // If not exists, then create a new one
          return await itemLoginService.create(repositories, item.path, type);
        }
      });
    },
  );
};

export default plugin;
