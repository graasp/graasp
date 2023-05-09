import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { Hostname, MentionStatus } from '@graasp/sdk';

import { buildRepositories } from '../../../../utils/repositories';
import { ChatMention } from './chatMention';
import commonMentions, {
  clearAllMentions,
  deleteMention,
  getMentions,
  patchMention,
} from './schemas';
import { MentionService } from './service';
import { UnauthorizedMember } from '../../../../utils/errors';

/**
 * Type definition for plugin options
 */
export interface GraaspChatPluginOptions {
  prefix?: string;
  hosts: Hostname[];
}

const plugin: FastifyPluginAsync<GraaspChatPluginOptions> = async (fastify, options) => {
  // isolate plugin content using fastify.register to ensure that the action hook from chat_message will not be called when using mention routes
  const { db, mailer, hosts } = fastify;
  const mentionService = new MentionService(mailer, hosts);

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
      mentions.forEach((mention) => {
        mentionService.sendMentionNotificationEmail({
          item,
          member: (mention as ChatMention).member,
          creator,
          // log,
        });
      });
    },
  );

  // mentions
  fastify.get('/mentions', { schema: getMentions, preHandler: fastify.fetchMemberInSession }, async ({ member, log }) => {
    if(!member) {
      throw new UnauthorizedMember(member);
    }
    return mentionService.getForMember(member, buildRepositories());
  });

  fastify.patch<{
    Params: { mentionId: string };
    Body: { status: MentionStatus };
  }>(
    '/mentions/:mentionId',
    { schema: patchMention, preHandler: fastify.verifyAuthentication },
    async ({ member, params: { mentionId }, body: { status }, log }) => {
      return db.transaction(async (manager) => {
        return mentionService.patch(member, buildRepositories(manager), mentionId, status);
      });
    },
  );

  // delete one mention by id
  fastify.delete<{ Params: { mentionId: string } }>(
    '/mentions/:mentionId',
    { schema: deleteMention, preHandler: fastify.verifyAuthentication },
    async ({ member, params: { mentionId }, log }) => {
      return db.transaction(async (manager) => {
        return mentionService.deleteOne(member, buildRepositories(manager), mentionId);
      });
    },
  );

  // delete all mentions for a user
  fastify.delete('/mentions', { schema: clearAllMentions, preHandler: fastify.verifyAuthentication }, async ({ member, log }, reply) => {
    await db.transaction(async (manager) => {
      await mentionService.deleteAll(member, buildRepositories(manager));
    });
    reply.status(StatusCodes.NO_CONTENT);
  });
};

export default plugin;
