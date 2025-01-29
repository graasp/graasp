import { singleton } from 'tsyringe';

import { Member, PermissionLevel } from '@graasp/sdk';

import { TRANSLATIONS } from '../../../../langs/constants';
import { BaseLogger } from '../../../../logger';
import { MailBuilder } from '../../../../plugins/mailer/builder';
import { MailerService } from '../../../../plugins/mailer/service';
import { BUILDER_HOST } from '../../../../utils/config';
import { Repositories } from '../../../../utils/repositories';
import { Item } from '../../../item/entities/Item';
import { isMember } from '../../../member/entities/member';

@singleton()
export class MembershipRequestService {
  private readonly mailerService: MailerService;
  private readonly log: BaseLogger;

  constructor(mailerService: MailerService, log: BaseLogger) {
    this.mailerService = mailerService;
    this.log = log;
  }

  async getAllByItem({ membershipRequestRepository }: Repositories, itemId: string) {
    return await membershipRequestRepository.getAllByItem(itemId);
  }

  async get({ membershipRequestRepository }: Repositories, memberId: string, itemId: string) {
    return await membershipRequestRepository.get(memberId, itemId);
  }

  async post({ membershipRequestRepository }: Repositories, memberId: string, itemId: string) {
    return await membershipRequestRepository.post(memberId, itemId);
  }

  async notifyAdmins(member: Member, { itemMembershipRepository }: Repositories, item: Item) {
    const adminMemberships = await itemMembershipRepository.getByItemPathAndPermission(
      item.path,
      PermissionLevel.Admin,
    );

    const link = new URL(`/items/${item.id}/share`, BUILDER_HOST.url).toString();

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

  async deleteOne({ membershipRequestRepository }: Repositories, memberId: string, itemId: string) {
    return await membershipRequestRepository.deleteOne(memberId, itemId);
  }
}
