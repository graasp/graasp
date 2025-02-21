import { singleton } from 'tsyringe';

import { ActionTriggers, Context } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { BaseLogger } from '../../../../logger';
import { MemberNotSignedUp } from '../../../../utils/errors';
import { ActionRepository } from '../../../action/action.repository';
import { Member } from '../../../member/entities/member';
import { MemberRepository } from '../../../member/repository';
import { AuthService } from '../../service';

@singleton()
export class MagicLinkService {
  private readonly log: BaseLogger;
  private readonly authService: AuthService;
  private readonly memberRepository: MemberRepository;
  private readonly actionRepository: ActionRepository;

  constructor(authService: AuthService, log: BaseLogger, memberRepository: MemberRepository) {
    this.authService = authService;
    this.memberRepository = memberRepository;
    this.log = log;
  }

  async sendRegisterMail(member: Member, url?: string) {
    await this.authService.generateRegisterLinkAndEmailIt(member, { url });
  }

  async login(db: DBConnection, body: { email: string }, url?: string) {
    const { email } = body;
    const member = await this.memberRepository.getByEmail(db, email);

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
      await this.actionRepository.postMany(actions);
    } else {
      this.log.warn(`Login attempt with non-existent email '${email}'`);
      throw new MemberNotSignedUp({ email });
    }
  }
}
