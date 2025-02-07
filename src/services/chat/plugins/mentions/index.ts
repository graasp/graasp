import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { asDefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated } from '../../../auth/plugins/passport';
import { clearAllMentions, deleteMention, getOwnMentions, patchMention } from './schemas';
import { MentionService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  // isolate plugin content using fastify.register to ensure that the action hook from chat_message will not be called when using mention routes
  const { db } = fastify;
  const mentionService = resolveDependency(MentionService);

  // TODO: MEMBERSHIP POSTHOOK: REMOVE MENTION TO AVOID PROVIDING ITEM INFO through message

  // mentions
  fastify.get(
    '/mentions',
    { schema: getOwnMentions, preHandler: isAuthenticated },
    async ({ user }) => {
      const member = asDefined(user?.account);
      return await mentionService.getForAccount(member, buildRepositories());
    },
  );

  fastify.patch(
    '/mentions/:mentionId',
    { schema: patchMention, preHandler: isAuthenticated },
    async ({ user, params: { mentionId }, body: { status } }) => {
      return db.transaction(async (manager) => {
        const member = asDefined(user?.account);
        return await mentionService.patch(member, buildRepositories(manager), mentionId, status);
      });
    },
  );

  // delete one mention by id
  fastify.delete(
    '/mentions/:mentionId',
    { schema: deleteMention, preHandler: isAuthenticated },
    async ({ user, params: { mentionId } }) => {
      return db.transaction(async (manager) => {
        const member = asDefined(user?.account);
        return mentionService.deleteOne(member, buildRepositories(manager), mentionId);
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
      await db.transaction(async (manager) => {
        await mentionService.deleteAll(member, buildRepositories(manager));
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default plugin;
