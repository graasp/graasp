import { PermissionLevel, buildItemLinkForBuilder } from '@graasp/sdk';

import type { MailerDecoration } from '../../../../plugins/mailer/index.js';
import { MAIL } from '../../../../plugins/mailer/langs/constants.js';
import { BUILDER_HOST } from '../../../../utils/config.js';
import HookManager from '../../../../utils/hook.js';
import { Repositories } from '../../../../utils/repositories.js';
import { validatePermission } from '../../../authorization.js';
import { Item } from '../../../item/entities/Item.js';
import { Member } from '../../../member/entities/member.js';
import { ChatMessage } from '../../chatMessage.js';
import { MemberCannotAccessMention } from '../../errors.js';

export class MentionService {
  hooks = new HookManager();
  mailer: MailerDecoration;

  constructor(mailer: MailerDecoration) {
    this.mailer = mailer;
  }

  async sendMentionNotificationEmail({
    item,
    member,
    creator,
  }: {
    item: Item;
    member: Member;
    creator: Member;
  }) {
    const itemLink = buildItemLinkForBuilder({
      origin: BUILDER_HOST.url.origin,
      itemId: item.id,
      chatOpen: true,
    });
    const lang = member?.extra?.lang as string;

    const translated = this.mailer.translate(lang);
    const subject = translated(MAIL.CHAT_MENTION_TITLE, {
      creatorName: creator.name,
      itemName: item.name,
    });
    const html = `
    ${this.mailer.buildText(translated(MAIL.GREETINGS))}
    ${this.mailer.buildText(
      translated(MAIL.CHAT_MENTION_TEXT, {
        creatorName: creator.name,
        itemName: item.name,
      }),
    )}
    ${this.mailer.buildButton(itemLink, translated(MAIL.CHAT_MENTION_BUTTON_TEXT))}`;

    const footer = this.mailer.buildFooter(lang);

    this.mailer.sendEmail(subject, member.email, itemLink, html, footer).catch((err) => {
      console.error(err);
      // log.warn(err, `mailer failed. notification link: ${itemLink}`);
    });
  }

  async createManyForItem(
    actor: Member,
    repositories: Repositories,
    message: ChatMessage,
    mentionedMembers: string[],
  ) {
    const { mentionRepository, itemRepository } = repositories;

    // check actor has access to item
    const item = await itemRepository.get(message.item.id);
    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    // TODO: optimize ? suppose same item - validate multiple times
    const results = await mentionRepository.postMany(mentionedMembers, message.id);

    this.hooks.runPostHooks('createMany', actor, repositories, { mentions: results, item });

    return results;
  }

  async getForMember(member: Member, repositories: Repositories) {
    const { mentionRepository } = repositories;
    return mentionRepository.getForMember(member.id);
  }

  async get(actor: Member, repositories: Repositories, mentionId: string) {
    const { mentionRepository } = repositories;
    const mentionContent = await mentionRepository.get(mentionId);

    if (mentionContent.member.id !== actor.id) {
      throw new MemberCannotAccessMention(mentionId);
    }

    return mentionContent;
  }

  async patch(actor: Member, repositories: Repositories, mentionId: string, status) {
    const { mentionRepository } = repositories;

    // check permission
    await this.get(actor, repositories, mentionId);

    return mentionRepository.patch(mentionId, status);
  }

  async deleteOne(actor: Member, repositories: Repositories, mentionId: string) {
    const { mentionRepository } = repositories;

    // check permission
    await this.get(actor, repositories, mentionId);

    return mentionRepository.deleteOne(mentionId);
  }

  async deleteAll(actor: Member, repositories: Repositories) {
    const { mentionRepository } = repositories;
    await mentionRepository.deleteAll(actor.id);
    //     const clearedChat: Chat = { id: this.targetId, messages: [] };
    //     await this.postHookHandler?.(clearedChat, this.actor, { log, handler });
  }
}
