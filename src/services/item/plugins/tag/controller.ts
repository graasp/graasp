import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { assertIsMember } from '../../../member/entities/member';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { createTagForItem, deleteTagForItem, getTagsForItem } from './schemas';
import { ItemTagService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;

  const itemTagService = resolveDependency(ItemTagService);

  fastify.get(
    '/:itemId/tags',
    { schema: getTagsForItem, preHandler: optionalIsAuthenticated },
    async ({ user, params: { itemId } }) => {
      return await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        return await itemTagService.getByItemId(user?.account, repositories, itemId);
      });
    },
  );

  fastify.post(
    '/:itemId/tags',
    {
      schema: createTagForItem,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params: { itemId }, body }, reply) => {
      await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        await itemTagService.create(user?.account, repositories, itemId, body);
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );

  fastify.delete(
    '/:itemId/tags/:tagId',
    {
      schema: deleteTagForItem,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params: { itemId, tagId } }, reply) => {
      await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        assertIsMember(user?.account);
        await itemTagService.delete(user.account, repositories, itemId, tagId);
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default plugin;
