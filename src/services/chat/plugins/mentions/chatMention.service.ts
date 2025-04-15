import { singleton } from 'tsyringe';

import { ClientManager, Context, MentionStatus, PermissionLevel } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { ChatMessageRaw, Item } from '../../../../drizzle/types';
import { TRANSLATIONS } from '../../../../langs/constants';
import { MailBuilder } from '../../../../plugins/mailer/builder';
import { MailerService } from '../../../../plugins/mailer/mailer.service';
import { AccountType, AuthenticatedUser } from '../../../../types';
import { AuthorizationService } from '../../../authorization';
import { ItemRepository } from '../../../item/item.repository';
import { MemberRepository } from '../../../member/member.repository';
import { MemberCannotAccessMention } from '../../errors';
import { ChatMentionRepository } from './chatMention.repository';

@singleton()
export class MentionService {
  private readonly mailerService: MailerService;
  private readonly authorizationService: AuthorizationService;
  private readonly itemRepository: ItemRepository;
  private readonly chatMentionRepository: ChatMentionRepository;
  private readonly memberRepository: MemberRepository;

  constructor(
    mailerService: MailerService,
    authorizationService: AuthorizationService,
    itemRepository: ItemRepository,
    chatMentionRepository: ChatMentionRepository,
    memberRepository: MemberRepository,
  ) {
    this.mailerService = mailerService;
    this.authorizationService = authorizationService;
    this.itemRepository = itemRepository;
    this.chatMentionRepository = chatMentionRepository;
    this.memberRepository = memberRepository;
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
    const itemLink = ClientManager.getInstance().getItemLink(Context.Builder, item.id, {
      chatOpen: true,
    });

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
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    message: ChatMessageRaw,
    mentionedMembers: string[],
  ) {
    // check actor has access to item
    const item = await this.itemRepository.getOneOrThrow(dbConnection, message.itemId);
    await this.authorizationService.validatePermission(
      dbConnection,
      PermissionLevel.Read,
      account,
      item,
    );

    const mentions = await this.chatMentionRepository.postMany(
      dbConnection,
      mentionedMembers,
      message.id,
    );

    mentions.forEach(async (mention) => {
      const { accountId } = mention;
      const member = await this.memberRepository.get(dbConnection, accountId);
      const memberInfo = member.toMemberInfo();
      if (memberInfo.type === AccountType.Individual) {
        this.sendMentionNotificationEmail({
          item,
          member: memberInfo,
          creator: account,
        });
      }
    });

    return mentions;
  }

  async getForAccount(dbConnection: DBConnection, authenticatedUser: AuthenticatedUser) {
    return this.chatMentionRepository.getForAccount(dbConnection, authenticatedUser.id);
  }

  async get(dbConnection: DBConnection, authenticatedUser: AuthenticatedUser, mentionId: string) {
    const mentionContent = await this.chatMentionRepository.get(dbConnection, mentionId);

    if (mentionContent.accountId !== authenticatedUser.id) {
      throw new MemberCannotAccessMention({ id: mentionId });
    }

    return mentionContent;
  }

  async patch(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    mentionId: string,
    status: MentionStatus,
  ) {
    // check permission
    await this.get(dbConnection, authenticatedUser, mentionId);

    return this.chatMentionRepository.patch(dbConnection, mentionId, status);
  }

  async deleteOne(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    mentionId: string,
  ) {
    // check permission
    await this.get(dbConnection, authenticatedUser, mentionId);

    return this.chatMentionRepository.deleteOne(dbConnection, mentionId);
  }

  async deleteAll(dbConnection: DBConnection, authenticatedUser: AuthenticatedUser) {
    await this.chatMentionRepository.deleteAll(dbConnection, authenticatedUser.id);
  }
}
