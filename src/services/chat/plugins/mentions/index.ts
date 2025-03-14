import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { asDefined } from '../../../../utils/assertions.js';
import { isAuthenticated } from '../../../auth/plugins/passport/index.js';
import { clearAllMentions, deleteMention, getOwnMentions, patchMention } from './schemas.js';
import { MentionService } from './service.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  // isolate plugin content using fastify.register to ensure that the action hook from chat_message will not be called when using mention routes
  const mentionService = resolveDependency(MentionService);

  // TODO: MEMBERSHIP POSTHOOK: REMOVE MENTION TO AVOID PROVIDING ITEM INFO through message

  // mentions
  fastify.get(
    '/mentions',
    { schema: getOwnMentions, preHandler: isAuthenticated },
    async ({ user }) => {
      const member = asDefined(user?.account);
      return await mentionService.getForAccount(db, member);
    },
  );

  fastify.patch(
    '/mentions/:mentionId',
    { schema: patchMention, preHandler: isAuthenticated },
    async ({ user, params: { mentionId }, body: { status } }) => {
      await db.transaction(async (tx) => {
        const member = asDefined(user?.account);
        await mentionService.patch(tx, member, mentionId, status);
      });
    },
  );

  // delete one mention by id
  fastify.delete(
    '/mentions/:mentionId',
    { schema: deleteMention, preHandler: isAuthenticated },
    async ({ user, params: { mentionId } }) => {
      const member = asDefined(user?.account);
      await db.transaction(async (tx) => {
        await mentionService.deleteOne(tx, member, mentionId);
      });
    },
  );

  // delete all mentions for a user
  fastify.delete(
    '/mentions',
    {
      schema: clearAllMentions,
      preHandler: isAuthenticated,
    },
    async ({ user }, reply) => {
      const member = asDefined(user?.account);
      await db.transaction(async (tx) => {
        await mentionService.deleteAll(tx, member);
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default plugin;
