import { singleton } from 'tsyringe';

import { MentionStatus, PermissionLevel, buildItemLinkForBuilder } from '@graasp/sdk';

import { MailBuilder } from '../../../../plugins/mailer/builder';
import { MAIL } from '../../../../plugins/mailer/langs/constants';
import { MailerService } from '../../../../plugins/mailer/service';
import { BUILDER_HOST } from '../../../../utils/config';
import HookManager from '../../../../utils/hook';
import { Repositories } from '../../../../utils/repositories';
import { Account } from '../../../account/entities/account';
import { validatePermission } from '../../../authorization';
import { Item } from '../../../item/entities/Item';
import { Member } from '../../../member/entities/member';
import { ChatMessage } from '../../chatMessage';
import { MemberCannotAccessMention } from '../../errors';

@singleton()
export class MentionService {
  hooks = new HookManager();
  private readonly mailerService: MailerService;

  constructor(mailerService: MailerService) {
    this.mailerService = mailerService;
  }

  async sendMentionNotificationEmail({
    item,
    member,
    creator,
  }: {
    item: Item;
    member: Member;
    creator: Account;
  }) {
    const itemLink = buildItemLinkForBuilder({
      origin: BUILDER_HOST.url.origin,
      itemId: item.id,
      chatOpen: true,
    });

    const mail = new MailBuilder({
      subject: {
        text: MAIL.CHAT_MENTION_TITLE,
        translationVariables: {
          creatorName: creator.name,
          itemName: item.name,
        },
      },
      lang: member.lang,
    })
      .addText(MAIL.CHAT_MENTION_TEXT, {
        creatorName: creator.name,
        itemName: item.name,
      })
      .addButton(MAIL.CHAT_MENTION_BUTTON_TEXT, itemLink)
      .build();

    this.mailerService.send(mail, member.email).catch((err) => {
      console.error(err);
    });
  }

  async createManyForItem(
    account: Account,
    repositories: Repositories,
    message: ChatMessage,
    mentionedMembers: string[],
  ) {
    const { mentionRepository, itemRepository } = repositories;

    // check actor has access to item
    const item = await itemRepository.getOneOrThrow(message.item.id);
    await validatePermission(repositories, PermissionLevel.Read, account, item);

    // TODO: optimize ? suppose same item - validate multiple times
    const results = await mentionRepository.postMany(mentionedMembers, message.id);

    this.hooks.runPostHooks('createMany', account, repositories, {
      mentions: results,
      item,
    });

    return results;
  }

  async getForAccount(account: Account, repositories: Repositories) {
    const { mentionRepository } = repositories;
    return mentionRepository.getForAccount(account.id);
  }

  async get(actor: Account, repositories: Repositories, mentionId: string) {
    const { mentionRepository } = repositories;
    const mentionContent = await mentionRepository.get(mentionId);

    if (mentionContent.account.id !== actor.id) {
      throw new MemberCannotAccessMention({ id: mentionId });
    }

    return mentionContent;
  }

  async patch(
    actor: Account,
    repositories: Repositories,
    mentionId: string,
    status: MentionStatus,
  ) {
    const { mentionRepository } = repositories;

    // check permission
    await this.get(actor, repositories, mentionId);

    return mentionRepository.patch(mentionId, status);
  }

  async deleteOne(actor: Account, repositories: Repositories, mentionId: string) {
    const { mentionRepository } = repositories;

    // check permission
    await this.get(actor, repositories, mentionId);

    return mentionRepository.deleteOne(mentionId);
  }

  async deleteAll(actor: Account, repositories: Repositories) {
    const { mentionRepository } = repositories;
    await mentionRepository.deleteAll(actor.id);
    //     const clearedChat: Chat = { id: this.targetId, messages: [] };
    //     await this.postHookHandler?.(clearedChat, this.actor, { log, handler });
  }
}
