import { singleton } from 'tsyringe';

import { ActionTriggers } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { BaseLogger } from '../../../../logger';
import { MemberInfo } from '../../../../types';
import { MemberNotSignedUp } from '../../../../utils/errors';
import { ActionRepository } from '../../../action/action.repository';
import { View } from '../../../item/plugins/action/itemAction.schemas';
import { MemberRepository } from '../../../member/member.repository';
import { AuthService } from '../../auth.service';

@singleton()
export class MagicLinkService {
  private readonly log: BaseLogger;
  private readonly authService: AuthService;
  private readonly memberRepository: MemberRepository;
  private readonly actionRepository: ActionRepository;

  constructor(
    authService: AuthService,
    log: BaseLogger,
    memberRepository: MemberRepository,
    actionRepository: ActionRepository,
  ) {
    this.authService = authService;
    this.memberRepository = memberRepository;
    this.actionRepository = actionRepository;
    this.log = log;
  }

  async sendRegisterMail(member: MemberInfo, url?: string) {
    await this.authService.generateRegisterLinkAndEmailIt(member, { url });
  }

  async login(dbConnection: DBConnection, body: { email: string }, url?: string) {
    const { email } = body;
    const member = await this.memberRepository.getByEmail(dbConnection, email);

    if (member) {
      await this.authService.generateLoginLinkAndEmailIt(member.toMemberInfo(), { url });
      const actions = [
        {
          creatorId: member.id,
          type: ActionTriggers.MemberLogin,
          view: View.Unknown,
          extra: { type: 'email' },
        },
      ];
      await this.actionRepository.postMany(dbConnection, actions);
    } else {
      this.log.warn(`Login attempt with non-existent email '${email}'`);
      throw new MemberNotSignedUp({ email });
    }
  }
}
