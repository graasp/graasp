import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { MentionStatus } from '@graasp/sdk';

import { buildRepositories } from '../../../../utils/repositories';
import { authenticated } from '../../../auth/plugins/passport';
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
  const { db, mailer } = fastify;
  const mentionService = new MentionService(mailer);

  fastify.decorate('mentions', { service: mentionService });

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
    async (creator, repositories, { mentions, item }) => {
      if (!creator) {
        return;
      }
      mentions.forEach((mention) => {
        mentionService.sendMentionNotificationEmail({
          item,
          member: (mention as ChatMention).member,
          creator,
        });
      });
    },
  );

  // mentions
  fastify.get('/mentions', { schema: getMentions, preHandler: authenticated }, async ({ user }) => {
    return mentionService.getForMember(user!.member!, buildRepositories());
  });

  fastify.patch<{
    Params: { mentionId: string };
    Body: { status: MentionStatus };
  }>(
    '/mentions/:mentionId',
    { schema: patchMention, preHandler: authenticated },
    async ({ user, params: { mentionId }, body: { status } }) => {
      return db.transaction(async (manager) => {
        return mentionService.patch(user!.member!, buildRepositories(manager), mentionId, status);
      });
    },
  );

  // delete one mention by id
  fastify.delete<{ Params: { mentionId: string } }>(
    '/mentions/:mentionId',
    { schema: deleteMention, preHandler: authenticated },
    async ({ user, params: { mentionId } }) => {
      return db.transaction(async (manager) => {
        return mentionService.deleteOne(user!.member!, buildRepositories(manager), mentionId);
      });
    },
  );

  // delete all mentions for a user
  fastify.delete(
    '/mentions',
    { schema: clearAllMentions, preHandler: authenticated },
    async ({ user }, reply) => {
      await db.transaction(async (manager) => {
        await mentionService.deleteAll(user!.member!, buildRepositories(manager));
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default plugin;
