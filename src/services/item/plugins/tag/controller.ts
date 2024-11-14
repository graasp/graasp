import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { createTagForItem, getTagsForItem } from './schemas';
import { ItemTagService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;

  const itemToTagService = resolveDependency(ItemTagService);

  fastify.get(
    '/:itemId/tags',
    { schema: getTagsForItem, preHandler: optionalIsAuthenticated },
    async ({ user, params: { itemId } }) => {
      return await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        return await itemToTagService.getByItemId(user?.account, repositories, itemId);
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

        await itemToTagService.create(user?.account, repositories, itemId, body);
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default plugin;
