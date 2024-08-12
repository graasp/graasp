import { singleton } from 'tsyringe';

import { MailerService } from '../../../../plugins/mailer/service';

@singleton()
export class MembershipRequestService {
  private readonly mailerService: MailerService;
  constructor(mailerService: MailerService) {
    this.mailerService = mailerService;
  }
}
