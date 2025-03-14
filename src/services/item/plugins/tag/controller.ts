import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { asDefined } from '../../../../utils/assertions.js';
import {
  isAuthenticated,
  matchOne,
  optionalIsAuthenticated,
} from '../../../auth/plugins/passport/index.js';
import { assertIsMember } from '../../../authentication.js';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole.js';
import { createTagForItem, deleteTagForItem, getTagsForItem } from './schemas.js';
import { ItemTagService } from './service.js';

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
