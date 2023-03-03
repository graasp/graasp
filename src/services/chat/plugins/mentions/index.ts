import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { Context, Hostname, MentionStatus, buildItemLinkForBuilder } from '@graasp/sdk';
import { MAIL } from '@graasp/translations';

import { buildRepositories } from '../../../../util/repositories';
import { Item } from '../../../item/entities/Item';
import { Member } from '../../../member/entities/member';
import { ChatMention } from './chatMention';
import commonMentions, {
  clearAllMentions,
  deleteMention,
  getMentions,
  patchMention,
} from './schemas';
import { MentionService } from './service';

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
  const mentionService = new MentionService();

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

  // TODO MEMBERSHIP POSTHOOK: REMOVE MENTION TO AVOID PROVIDING ITEM INFO through message

  const host = hosts.find((h) => h.name === Context.BUILDER)?.hostname;

  const sendMentionNotificationEmail = ({
    item,
    member,
    creator,
  }: // log,
  {
    item: Item;
    member: Member;
    creator: Member;
    // log: FastifyLoggerInstance;
  }) => {
    const itemLink = buildItemLinkForBuilder({
      origin: host,
      itemId: item.id,
      chatOpen: true,
    });
    const lang = member?.extra?.lang as string;

    const translated = mailer.translate(lang);
    const subject = translated(MAIL.CHAT_MENTION_TITLE);
    const html = `
    ${mailer.buildText(translated(MAIL.GREETINGS))}
    ${mailer.buildText(translated(MAIL.CHAT_MENTION_TEXT, { creator }))}
    ${mailer.buildButton(itemLink, translated(MAIL.CHAT_MENTION_BUTTON_TEXT))}`;

    mailer.sendEmail(subject, member.email, itemLink, html).catch((err) => {
      console.error(err);
      // log.warn(err, `mailer failed. notification link: ${itemLink}`);
    });
  };

  // send email on mention creation
  mentionService.hooks.setPostHook(
    'createMany',
    async (creator, repositories, { mentions, item }) => {
      mentions.forEach((mention) => {
        sendMentionNotificationEmail({
          item,
          member: (mention as ChatMention).member,
          creator,
          // log,
        });
      });
    },
  );

  // mentions
  fastify.get('/mentions', { schema: getMentions }, async ({ member, log }) => {
    return mentionService.getForMember(member, buildRepositories());
  });

  fastify.patch<{
    Params: { mentionId: string };
    Body: { status: MentionStatus };
  }>(
    '/mentions/:mentionId',
    { schema: patchMention },
    async ({ member, params: { mentionId }, body: { status }, log }) => {
      return mentionService.patch(member, buildRepositories(), mentionId, status);
    },
  );

  // delete one mention by id
  fastify.delete<{ Params: { mentionId: string } }>(
    '/mentions/:mentionId',
    { schema: deleteMention },
    async ({ member, params: { mentionId }, log }) => {
      return db.transaction(async (manager) => {
        return mentionService.deleteOne(member, buildRepositories(manager), mentionId);
      });
    },
  );

  // delete all mentions for a user
  fastify.delete('/mentions', { schema: clearAllMentions }, async ({ member, log }, reply) => {
    await db.transaction(async (manager) => {
      await mentionService.deleteAll(member, buildRepositories(manager));
    });
    reply.status(StatusCodes.NO_CONTENT);
  });
};

export default plugin;
