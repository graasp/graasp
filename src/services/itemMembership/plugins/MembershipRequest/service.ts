import { singleton } from 'tsyringe';

import { ClientManager, Context } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db.js';
import type { Item } from '../../../../drizzle/types.js';
import { TRANSLATIONS } from '../../../../langs/constants.js';
import { BaseLogger } from '../../../../logger.js';
import { MailBuilder } from '../../../../plugins/mailer/builder.js';
import { MailerService } from '../../../../plugins/mailer/mailer.service.js';
import { AccountType, type MinimalMember } from '../../../../types.js';
import { ItemMembershipRepository } from '../../repository.js';
import { MembershipRequestRepository } from './repository.js';

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

  async getAllByItem(db: DBConnection, itemId: string) {
    return await this.membershipRequestRepository.getAllByItem(db, itemId);
  }

  async get(db: DBConnection, memberId: string, itemId: string) {
    return await this.membershipRequestRepository.get(db, memberId, itemId);
  }

  async post(db: DBConnection, memberId: string, itemId: string) {
    return await this.membershipRequestRepository.post(db, memberId, itemId);
  }

  async notifyAdmins(db: DBConnection, member: MinimalMember, item: Item) {
    const admins = await this.itemMembershipRepository.getAdminsForItem(db, item.path);

    const link = ClientManager.getInstance().getLinkByContext(
      Context.Builder,
      `/items/${item.id}/share`,
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
        this.log.error(err, `mailerService failed. shared link: ${link}`);
      });
    }
  }

  async deleteOne(db: DBConnection, memberId: string, itemId: string) {
    return await this.membershipRequestRepository.deleteOne(db, memberId, itemId);
  }
}
