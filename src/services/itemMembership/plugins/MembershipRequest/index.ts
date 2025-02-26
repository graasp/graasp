import { fastifyCors } from '@fastify/cors';
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { MembershipRequestStatus, PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { ItemNotFound } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated } from '../../../auth/plugins/passport';
import { AuthorizationService, hasPermission, matchOne } from '../../../authorization';
import { ItemRepository } from '../../../item/repository';
import { ItemService } from '../../../item/service';
import { ItemLoginSchemaExists } from '../../../itemLogin/errors';
import { ItemLoginService } from '../../../itemLogin/service';
import { assertIsMember } from '../../../member/entities/member';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ItemMembershipService } from '../../service';
import {
  ItemMembershipAlreadyExists,
  MembershipRequestAlreadyExists,
  MembershipRequestNotFound,
} from './error';
import { createOne, deleteOne, getAllByItem, getOwn } from './schemas';
import { MembershipRequestService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const membershipRequestService = resolveDependency(MembershipRequestService);
  const itemMembershipService = resolveDependency(ItemMembershipService);
  const itemService = resolveDependency(ItemService);
  const itemRepository = resolveDependency(ItemRepository);
  const itemLoginService = resolveDependency(ItemLoginService);

  if (fastify.corsPluginOptions) {
    await fastify.register(fastifyCors, fastify.corsPluginOptions);
  }

  fastify.get(
    '/',
    {
      schema: getAllByItem,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params }, reply) => {
      const member = asDefined(user?.account);
      const { itemId } = params;

      await db.transaction(async (tsx) => {
        // Check if the Item exists and the member has the required permission.
        await itemService.get(tsx, member, itemId, PermissionLevel.Admin);

        const requests = await membershipRequestService.getAllByItem(tsx, itemId);
        reply.send(requests);
      });
    },
  );

  fastify.get(
    '/own',
    {
      schema: getOwn,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params }, reply) => {
      const member = asDefined(user?.account);
      const { itemId } = params;

      await db.transaction(async (tsx) => {
        const membershipRequest = await membershipRequestService.get(tsx, member.id, itemId);
        if (membershipRequest) {
          return reply.send({ status: MembershipRequestStatus.Pending });
        }

        const itemMembership = await itemMembershipService.hasMembershipOnItem(
          tsx,
          member.id,
          itemId,
        );
        if (itemMembership) {
          return reply.send({ status: MembershipRequestStatus.Approved });
        }

        const item = await itemRepository.getOneOrThrow(tsx, itemId);
        if (item) {
          return reply.send({ status: MembershipRequestStatus.NotSubmittedOrDeleted });
        }

        throw new ItemNotFound(itemId);
      });
    },
  );

  fastify.post(
    '/',
    {
      schema: createOne,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params }, reply) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      const { itemId } = params;

      await db.transaction(async (tsx) => {
        const membershipRequest = await membershipRequestService.get(tsx, member.id, itemId);
        if (membershipRequest) {
          throw new MembershipRequestAlreadyExists();
        }
        //TODO: replace by transaction tx
        const item = await itemRepository.getOneOrThrow(db, itemId);

        const itemLoginSchema = await itemLoginService.getByItemPath(tsx, item.path);
        if (itemLoginSchema) {
          throw new ItemLoginSchemaExists();
        }

        // Check if the member already has an access to the item (from membership or item visibility), if so, throw an error
        if (await hasPermission(tsx, PermissionLevel.Read, member, item)) {
          throw new ItemMembershipAlreadyExists();
        }

        const result = await membershipRequestService.post(tsx, member.id, itemId);
        await membershipRequestService.notifyAdmins(tsx, member, item);
        reply.send(result);
      });
    },
  );

  fastify.delete(
    '/:memberId',
    {
      schema: deleteOne,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params }, reply) => {
      const member = asDefined(user?.account);
      const { itemId, memberId } = params;

      await db.transaction(async (tsx) => {
        // Check if the Item exists and the member has the required permission
        await itemService.get(tsx, member, itemId, PermissionLevel.Admin);

        const requests = await membershipRequestService.deleteOne(tsx, memberId, itemId);
        if (!requests) {
          throw new MembershipRequestNotFound();
        }
        reply.send(requests);
      });
    },
  );
};
export default plugin;
