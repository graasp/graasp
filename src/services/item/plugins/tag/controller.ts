import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { matchOne } from '../../../authorization';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { createTagForItem, deleteTagForItem, getTagsForItem } from './schemas';
import { ItemTagService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const itemTagService = resolveDependency(ItemTagService);

  fastify.get(
    '/:itemId/tags',
    { schema: getTagsForItem, preHandler: optionalIsAuthenticated },
    async ({ user, params: { itemId } }) => {
      return await itemTagService.getByItemId(db, user?.account, itemId);
    },
  );

  fastify.post(
    '/:itemId/tags',
    {
      schema: createTagForItem,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params: { itemId }, body }, reply) => {
      const account = asDefined(user?.account);
      assertIsMember(account);
      await db.transaction(async (tx) => {
        await itemTagService.create(tx, account, itemId, body);
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
      const account = asDefined(user?.account);
      assertIsMember(account);
      await db.transaction(async (tx) => {
        await itemTagService.delete(tx, account, itemId, tagId);
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default plugin;
