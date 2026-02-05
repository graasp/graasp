import { singleton } from 'tsyringe';

import { ClientManager, Context } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { type ItemRaw } from '../../../../drizzle/types';
import { TRANSLATIONS } from '../../../../langs/constants';
import { BaseLogger } from '../../../../logger';
import { MailBuilder } from '../../../../plugins/mailer/builder';
import { MailerService } from '../../../../plugins/mailer/mailer.service';
import { AccountType, type MinimalMember } from '../../../../types';
import { ItemMembershipRepository } from '../../membership.repository';
import { MembershipRequestRepository } from './membershipRequest.repository';

@singleton()
export class MembershipRequestService {
  private readonly mailerService: MailerService;
  private readonly log: BaseLogger;
  private readonly membershipRequestRepository: MembershipRequestRepository;
  private readonly itemMembershipRepository: ItemMembershipRepository;

  constructor(
    mailerService: MailerService,
    log: BaseLogger,
    itemMembershipRepository: ItemMembershipRepository,
    membershipRequestRepository: MembershipRequestRepository,
  ) {
    this.mailerService = mailerService;
    this.itemMembershipRepository = itemMembershipRepository;
    this.membershipRequestRepository = membershipRequestRepository;
    this.log = log;
  }

  async getAllByItem(dbConnection: DBConnection, itemId: string) {
    return await this.membershipRequestRepository.getAllByItem(dbConnection, itemId);
  }

  async get(dbConnection: DBConnection, memberId: string, itemId: string) {
    return await this.membershipRequestRepository.get(dbConnection, memberId, itemId);
  }

  async post(dbConnection: DBConnection, memberId: string, itemId: string) {
    return await this.membershipRequestRepository.post(dbConnection, memberId, itemId);
  }

  async notifyAdmins(dbConnection: DBConnection, member: MinimalMember, item: ItemRaw) {
    const admins = await this.itemMembershipRepository.getAdminsForItem(dbConnection, item.path);

    const link = ClientManager.getInstance().getLinkByContext(
      Context.Builder,
      `items/${item.id}/share`,
    );

    for (const admin of admins) {
      if (admin.type !== AccountType.Individual) {
        continue;
      }

      const mail = new MailBuilder({
        subject: {
          text: TRANSLATIONS.MEMBERSHIP_REQUEST_TITLE,
          translationVariables: {
            memberName: member.name,
            itemName: item.name,
          },
        },
        lang: admin.extra.lang,
      })
        .addText(TRANSLATIONS.MEMBERSHIP_REQUEST_TEXT, {
          memberName: member.name,
          itemName: item.name,
        })
        .addButton(TRANSLATIONS.MEMBERSHIP_REQUEST_BUTTON_TEXT, link, {
          itemName: item.name,
        })
        .build();

      this.mailerService.send(mail, admin.email!).catch((err) => {
        this.log.error(`mailerService failed with ${err.message}. shared link: ${link}`);
      });
    }
  }

  async deleteOne(dbConnection: DBConnection, memberId: string, itemId: string) {
    return await this.membershipRequestRepository.deleteOne(dbConnection, memberId, itemId);
  }
}
