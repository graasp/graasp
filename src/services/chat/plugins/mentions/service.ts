import { Context, Hostname, PermissionLevel, buildItemLinkForBuilder } from '@graasp/sdk';

import HookManager from '../../../../utils/hook';
import { Repositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import { ChatMessage } from '../../chatMessage';
import { MemberCannotAccessMention } from '../../errors';
import type { MailerDecoration } from '../../../../plugins/mailer';
import { Item } from '../../../item/entities/Item';
import { Member } from '../../../member/entities/member';
import { MAIL } from '@graasp/translations';
import { CLIENT_HOST } from '../../../../utils/config';

export class MentionService {
  hooks = new HookManager();
  mailer: MailerDecoration;
  hosts: Hostname[];

  constructor(mailer: MailerDecoration, hosts: Hostname[]) {
    this.mailer = mailer;
    this.hosts = hosts;
  }

  async sendMentionNotificationEmail({
    item,
    member,
    creator,
  }:
    {
      item: Item;
      member: Member;
      creator: Member;
    }) {

    const host = this.hosts.find((h) => h.name === Context.BUILDER)?.hostname;
    if (!host) {
      throw new Error('host is not defined');
    }
    const itemLink = buildItemLinkForBuilder({
      origin: host,
      itemId: item.id,
      chatOpen: true,
    });
    const lang = member?.extra?.lang as string;

    const translated = this.mailer.translate(lang);
    const subject = translated(MAIL.CHAT_MENTION_TITLE);
    const html = `
    ${this.mailer.buildText(translated(MAIL.GREETINGS))}
    ${this.mailer.buildText(translated(MAIL.CHAT_MENTION_TEXT, { creator }))}
    ${this.mailer.buildButton(itemLink, translated(MAIL.CHAT_MENTION_BUTTON_TEXT))}`;

    this.mailer.sendEmail(subject, member.email, itemLink, html).catch((err) => {
      console.error(err);
      // log.warn(err, `mailer failed. notification link: ${itemLink}`);
    });
  }

  async createManyForItem(
    actor,
    repositories: Repositories,
    message: ChatMessage,
    mentionedMembers: string[],
  ) {
    const { mentionRepository, itemRepository } = repositories;

    // check actor has access to item
    const item = await itemRepository.get(message.item.id);
    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    // TODO: optimize ? suppose same item - validate multiple times
    const results = await mentionRepository.postMany(mentionedMembers, message, item);

    this.hooks.runPostHooks('createMany', actor, repositories, { mentions: results, item });

    return results;
  }

  async getForMember(actor, repositories: Repositories) {
    const { mentionRepository } = repositories;
    return mentionRepository.getForMember(actor.id);
  }

  async get(
    actor,
    repositories: Repositories,
    mentionId: string,
    options = { shouldExist: false },
  ) {
    const { mentionRepository } = repositories;
    const mentionContent = await mentionRepository.get(mentionId, options);

    if (mentionContent.member.id !== actor.id) {
      throw new MemberCannotAccessMention(mentionId);
    }

    return mentionContent;
  }

  async patch(actor, repositories: Repositories, mentionId: string, status) {
    const { mentionRepository } = repositories;

    // check permission
    await this.get(actor, repositories, mentionId, { shouldExist: true });

    return mentionRepository.patch(mentionId, status);
  }

  async deleteOne(actor, repositories: Repositories, mentionId: string) {
    const { mentionRepository } = repositories;

    // check permission
    await this.get(actor, repositories, mentionId, { shouldExist: true });

    return mentionRepository.deleteOne(mentionId);
  }

  async deleteAll(actor, repositories: Repositories) {
    const { mentionRepository } = repositories;
    return mentionRepository.deleteAll(actor.id);
    //     const clearedChat: Chat = { id: this.targetId, messages: [] };
    //     await this.postHookHandler?.(clearedChat, this.actor, { log, handler });
  }
}
