import { singleton } from 'tsyringe';

import { ClientManager, Context, Member, PermissionLevel } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { TRANSLATIONS } from '../../../../langs/constants';
import { BaseLogger } from '../../../../logger';
import { MailBuilder } from '../../../../plugins/mailer/builder';
import { MailerService } from '../../../../plugins/mailer/mailer.service';
import { Item } from '../../../item/entities/Item';
import { isMember } from '../../../member/entities/member';
import { MembershipRequestRepository } from './repository';

@singleton()
export class MembershipRequestService {
  private readonly mailerService: MailerService;
  private readonly log: BaseLogger;
  private readonly membershipRequestRepository: MembershipRequestRepository;

  constructor(mailerService: MailerService, log: BaseLogger) {
    this.mailerService = mailerService;
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

  async notifyAdmins(db: DBConnection, member: Member, item: Item) {
    const adminMemberships = await this.itemMembershipRepository.getByItemPathAndPermission(
      db,
      item.path,
      PermissionLevel.Admin,
    );

    const link = ClientManager.getInstance().getLinkByContext(
      Context.Builder,
      `/items/${item.id}/share`,
    );

    for (const adminMembership of adminMemberships) {
      const admin = adminMembership.account;
      if (!isMember(admin)) {
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
        lang: admin.lang,
      })
        .addText(TRANSLATIONS.MEMBERSHIP_REQUEST_TEXT, {
          memberName: member.name,
          itemName: item.name,
        })
        .addButton(TRANSLATIONS.MEMBERSHIP_REQUEST_BUTTON_TEXT, link, {
          itemName: item.name,
        })
        .build();

      this.mailerService.send(mail, admin.email).catch((err) => {
        this.log.error(err, `mailerService failed. shared link: ${link}`);
      });
    }
  }

  async deleteOne(db: DBConnection, memberId: string, itemId: string) {
    return await this.membershipRequestRepository.deleteOne(db, memberId, itemId);
  }
}
