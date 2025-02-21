import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ItemLoginSchemaStatus, PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../di/utils';
import { EntryNotFoundBeforeDeleteException } from '../../repositories/errors';
import { asDefined } from '../../utils/assertions';
import { ItemNotFound } from '../../utils/errors';
import { buildRepositories } from '../../utils/repositories';
import { SESSION_KEY, isAuthenticated, optionalIsAuthenticated } from '../auth/plugins/passport';
import { isItemVisible, matchOne } from '../authorization';
import { ItemVisibilityService } from '../item/plugins/itemVisibility/service';
import { ItemService } from '../item/service';
import { ItemMembershipService } from '../itemMembership/service';
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
import { DBConnection } from '../../drizzle/db';


// TODO: This is only used here but should probably be put in a better place than the plugin file
export async function isItemVisible(
  db: DBConnection,
  services: {itemVisibilityService: ItemVisibilityService, }
  actor: Actor,
  itemPath: Item['path'],
) {
  const {itemVisibilityService} = services;
  const isHidden = await itemVisibilityService.has(
    repositories,
    itemPath,
    ItemVisibilityType.Hidden,
  );
  // If the item is hidden AND there is no membership with the user, then throw an error
  if (isHidden) {
    if (!actor) {
      // If actor is not provided, then there is no membership
      return false;
    }

    // Check if the actor has at least write permission
    const membership = await itemMembershipService.getByAccountAndItemPath(
      repositories,
      actor?.id,
      itemPath,
    );
    if (!membership || PermissionLevelCompare.lt(membership.permission, PermissionLevel.Write)) {
      return false;
    }
  }

  return true;
}


const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;

  const itemLoginService = resolveDependency(ItemLoginService);
  const itemService = resolveDependency(ItemService);
  const itemVisibilityService = resolveDependency(ItemVisibilityService);
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
        const item = await repositories.itemRepository.getOneOrThrow(itemId);

        // If item is not visible, throw NOT_FOUND
        const isVisible = await isItemVisible(
          tx,
          user?.account,
          { itemVisibilityService, itemMembershipService },
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
      schema: getItemLoginSchema,
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
      schema: loginOrRegisterAsGuest,
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

  fastify.delete<{ Params: { id: string } }>(
    '/:id/login-schema',
    {
      schema: deleteLoginSchema,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params: { id: itemId } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return db.transaction(async (manager) => {
        try {
          const repositories = buildRepositories(manager);

          // Validate permission
          await itemService.get(member, repositories, itemId, PermissionLevel.Admin);

          const { id } = await itemLoginService.delete(member, repositories, itemId);
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
