import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { ItemType, PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { notUndefined } from '../../../../utils/assertions';
import { ItemNotFolder } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated } from '../../../auth/plugins/passport';
import { matchOne, validatePermission } from '../../../authorization';
import { ItemService } from '../../../item/service';
import { validatedMember } from '../../../member/strategies/validatedMember';
import {
  ItemMembershipAlreadyExists,
  MembershipRequestAlreadyExists,
  MembershipRequestNotFound,
} from './error';
import common, { createOne, deleteOne, getAllByItem } from './schemas';
import { MembershipRequestService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;

  const membershipRequestService = resolveDependency(MembershipRequestService);
  const itemService = resolveDependency(ItemService);

  // schemas
  fastify.addSchema(common);

  fastify.get<{ Params: { itemId: string } }>(
    '/items/:itemId/memberships/requests',
    {
      schema: getAllByItem,
      preHandler: [isAuthenticated, matchOne(validatedMember)],
    },
    async ({ user, params }, reply) => {
      const member = notUndefined(user?.member);
      const { itemId } = params;

      await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        // Check if the Item exists and the member has the required permission
        await itemService.get(member, repositories, itemId, PermissionLevel.Admin);

        const requests = await membershipRequestService.getAllByItem(repositories, itemId);
        reply.send(requests);
      });
    },
  );

  fastify.post<{ Params: { itemId: string } }>(
    '/items/:itemId/memberships/requests',
    {
      schema: createOne,
      preHandler: [isAuthenticated, matchOne(validatedMember)],
    },
    async ({ user, params }, reply) => {
      const member = notUndefined(user?.member);
      const { itemId } = params;

      await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        const membershipRequest = await membershipRequestService.get(
          repositories,
          member.id,
          itemId,
        );
        if (membershipRequest) {
          throw new MembershipRequestAlreadyExists();
        }

        const item = await itemService.get(
          member,
          repositories,
          itemId,
          PermissionLevel.Read,
          false,
        );
        if (item.type !== ItemType.FOLDER) {
          throw new ItemNotFolder({ id: itemId });
        }

        // Check if the member already has a membership, if so, throw an error
        let hasPermission = true;
        try {
          await validatePermission(repositories, PermissionLevel.Read, member, item);
        } catch (err) {
          hasPermission = err.statusCode !== StatusCodes.FORBIDDEN;
        }
        if (hasPermission) {
          throw new ItemMembershipAlreadyExists();
        }

        const result = await membershipRequestService.post(repositories, member.id, itemId);
        await membershipRequestService.notifyAdmins(member, repositories, item);
        reply.send(result);
      });
    },
  );

  fastify.delete<{ Params: { itemId: string; memberId: string } }>(
    '/items/:itemId/memberships/requests/:memberId',
    {
      schema: deleteOne,
      preHandler: [isAuthenticated, matchOne(validatedMember)],
    },
    async ({ user, params }, reply) => {
      const member = notUndefined(user?.member);
      const { itemId, memberId } = params;

      await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        // Check if the Item exists and the member has the required permission
        await itemService.get(member, repositories, itemId, PermissionLevel.Admin);

        const requests = await membershipRequestService.deleteOne(repositories, memberId, itemId);
        if (!requests) {
          throw new MembershipRequestNotFound();
        }
        reply.send(requests);
      });
    },
  );
};
export default plugin;
