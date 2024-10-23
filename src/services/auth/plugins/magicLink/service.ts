import { singleton } from 'tsyringe';

import { ActionTriggers, Context } from '@graasp/sdk';

import { BaseLogger } from '../../../../logger';
import { MemberNotSignedUp } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { Actor, Member } from '../../../member/entities/member';
import { AuthService } from '../../service';

@singleton()
export class MagicLinkService {
  private readonly log: BaseLogger;
  private readonly authService: AuthService;

  constructor(authService: AuthService, log: BaseLogger) {
    this.authService = authService;
    this.log = log;
  }

  async sendRegisterMail(actor: Actor, repositories: Repositories, member: Member, url?: string) {
    await this.authService.generateRegisterLinkAndEmailIt(member, { url });
  }

  async login(actor: Actor, repositories: Repositories, body, url?: string) {
    const { memberRepository, actionRepository } = repositories;
    const { email } = body;
    const member = await memberRepository.getByEmail(email);

    if (member) {
      await this.authService.generateLoginLinkAndEmailIt(member, { url });
      const actions = [
        {
          member,
          type: ActionTriggers.MemberLogin,
          view: Context.Unknown,
          extra: { type: 'email' },
        },
      ];
      await actionRepository.postMany(actions);
    } else {
      this.log.warn(`Login attempt with non-existent email '${email}'`);
      throw new MemberNotSignedUp({ email });
    }
  }
}
