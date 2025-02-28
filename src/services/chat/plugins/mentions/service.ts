import { singleton } from 'tsyringe';

import {
  ClientManager,
  Context,
  MentionStatus,
  PermissionLevel,
} from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { ChatMessageRaw, Item } from '../../../../drizzle/types';
import { TRANSLATIONS } from '../../../../langs/constants';
import { MailBuilder } from '../../../../plugins/mailer/builder';
import { MailerService } from '../../../../plugins/mailer/mailer.service';
import { AuthenticatedUser } from '../../../../types';
import { Account } from '../../../account/entities/account';
import { AuthorizationService } from '../../../authorization';
import { ItemRepository } from '../../../item/repository';
import { MemberCannotAccessMention } from '../../errors';
import { ChatMentionRepository } from './repository';

@singleton()
export class MentionService {
  private readonly mailerService: MailerService;
  private readonly authorizationService: AuthorizationService;
  private readonly itemRepository: ItemRepository;
  private readonly chatMentionRepository: ChatMentionRepository;

  constructor(
    mailerService: MailerService,
    authorizationService: AuthorizationService,
    itemRepository: ItemRepository,
    chatMentionRepository: ChatMentionRepository,
  ) {
    this.mailerService = mailerService;
    this.authorizationService = authorizationService;
    this.itemRepository = itemRepository;
    this.chatMentionRepository = chatMentionRepository;
  }

  async sendMentionNotificationEmail({
    item,
    member,
    creator,
  }: {
    item: Item;
    member: { email: string; lang: string };
    creator: { name: string };
  }) {
    const itemLink = ClientManager.getInstance().getItemLink(
      Context.Builder,
      item.id,
      {
        chatOpen: true,
      },
    );

    const mail = new MailBuilder({
      subject: {
        text: TRANSLATIONS.CHAT_MENTION_TITLE,
        translationVariables: {
          creatorName: creator.name,
          itemName: item.name,
        },
      },
      lang: member.lang,
    })
      .addText(TRANSLATIONS.CHAT_MENTION_TEXT, {
        creatorName: creator.name,
        itemName: item.name,
      })
      .addButton(TRANSLATIONS.CHAT_MENTION_BUTTON_TEXT, itemLink)
      .build();

    this.mailerService.send(mail, member.email).catch((err) => {
      console.error(err);
    });
  }

  async createManyForItem(
    db: DBConnection,
    account: AuthenticatedUser,
    message: ChatMessageRaw,
    mentionedMembers: string[],
  ) {
    // check actor has access to item
    const item = await this.itemRepository.getOneOrThrow(db, message.itemId);
    await this.authorizationService.validatePermission(
      db,
      PermissionLevel.Read,
      account,
      item,
    );

    // TODO: optimize ? suppose same item - validate multiple times
    const mentions = await this.chatMentionRepository.postMany(
      db,
      mentionedMembers,
      message.id,
    );

    mentions.forEach((mention) => {
      const member = mention.account;
      if (isMember(member)) {
        this.sendMentionNotificationEmail({ item, member, creator: account });
      }
    });

    return mentions;
  }

  async getForAccount(db: DBConnection, authenticatedUser: AuthenticatedUser) {
    return this.chatMentionRepository.getForAccount(db, authenticatedUser.id);
  }

  async get(db: DBConnection, actor: Account, mentionId: string) {
    const mentionContent = await this.chatMentionRepository.get(db, mentionId);

    if (mentionContent.account.id !== actor.id) {
      throw new MemberCannotAccessMention({ id: mentionId });
    }

    return mentionContent;
  }

  async patch(
    db: DBConnection,
    actor: Account,
    mentionId: string,
    status: MentionStatus,
  ) {
    // check permission
    await this.get(db, actor, mentionId);

    return this.chatMentionRepository.patch(db, mentionId, status);
  }

  async deleteOne(db: DBConnection, actor: Account, mentionId: string) {
    // check permission
    await this.get(db, actor, mentionId);

    return this.chatMentionRepository.deleteOne(db, mentionId);
  }

  async deleteAll(db: DBConnection, actor: Account) {
    await this.chatMentionRepository.deleteAll(db, actor.id);
    //     const clearedChat: Chat = { id: this.targetId, messages: [] };
    //     await this.postHookHandler?.(clearedChat, this.actor, { log, handler });
  }
}
