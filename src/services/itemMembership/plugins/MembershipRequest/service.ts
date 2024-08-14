import { singleton } from 'tsyringe';

import { Member, PermissionLevel } from '@graasp/sdk';

import { BaseLogger } from '../../../../logger';
import { MAIL } from '../../../../plugins/mailer/langs/constants';
import { MailerService } from '../../../../plugins/mailer/service';
import { BUILDER_HOST } from '../../../../utils/config';
import { Repositories } from '../../../../utils/repositories';
import { Item } from '../../../item/entities/Item';

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
      const lang = adminMembership.member.lang;
      const translated = this.mailerService.translate(lang);
      this.mailerService
        .sendEmail(
          translated(MAIL.MEMBERSHIP_REQUEST_TITLE, {
            memberName: member.name,
            itemName: item.name,
          }),
          adminMembership.member.email,
          link,
          `
          ${this.mailerService.buildText(translated(MAIL.MEMBERSHIP_REQUEST_TEXT, { memberName: member.name, itemName: item.name }))}
          ${this.mailerService.buildButton(link, translated(MAIL.MEMBERSHIP_REQUEST_BUTTON_TEXT, { itemName: item.name }))}
        `,
          this.mailerService.buildFooter(lang),
        )
        .catch((err) => {
          this.log.error(err, `mailerService failed. shared link: ${link}`);
        });
    }
  }

  async deleteOne({ membershipRequestRepository }: Repositories, memberId: string, itemId: string) {
    return await membershipRequestRepository.deleteOne(memberId, itemId);
  }
}
