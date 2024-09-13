import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { MentionStatus } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { asDefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated } from '../../../auth/plugins/passport';
import { isMember } from '../../../member/entities/member';
import { ChatMention } from './chatMention';
import commonMentions, {
  clearAllMentions,
  deleteMention,
  getMentions,
  patchMention,
} from './schemas';
import { MentionService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  // isolate plugin content using fastify.register to ensure that the action hook from chat_message will not be called when using mention routes
  const { db } = fastify;
  const mentionService = resolveDependency(MentionService);

  fastify.addSchema(commonMentions);

  // // register websocket behaviours for chats
  // if (websockets) {
  //   registerChatMentionsWsHooks(
  //     websockets,
  //     runner,
  //     mentionService,
  //     membersService,
  //     itemMembershipsService,
  //     iTM,
  //     chatTaskManager,
  //     taskManager,
  //     db.pool,
  //   );
  // }

  // TODO: MEMBERSHIP POSTHOOK: REMOVE MENTION TO AVOID PROVIDING ITEM INFO through message

  // send email on mention creation
  mentionService.hooks.setPostHook(
    'createMany',
    async (creator, _repositories, { mentions, item }) => {
      if (!creator) {
        return;
      }
      mentions.forEach((mention) => {
        const member = (mention as ChatMention).account;
        if (isMember(member)) {
          mentionService.sendMentionNotificationEmail({ item, member, creator });
        }
      });
    },
  );

  // mentions
  fastify.get(
    '/mentions',
    { schema: getMentions, preHandler: isAuthenticated },
    async ({ user }) => {
      const member = asDefined(user?.account);
      return mentionService.getForAccount(member, buildRepositories());
    },
  );

  fastify.patch<{
    Params: { mentionId: string };
    Body: { status: MentionStatus };
  }>(
    '/mentions/:mentionId',
    { schema: patchMention, preHandler: isAuthenticated },
    async ({ user, params: { mentionId }, body: { status } }) => {
      return db.transaction(async (manager) => {
        const member = asDefined(user?.account);
        return mentionService.patch(member, buildRepositories(manager), mentionId, status);
      });
    },
  );

  // delete one mention by id
  fastify.delete<{ Params: { mentionId: string } }>(
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
