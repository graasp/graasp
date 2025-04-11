import { singleton } from 'tsyringe';

import { DEFAULT_LANG } from '@graasp/translations';

import { type DBConnection } from '../../../../drizzle/db';
import { BaseLogger } from '../../../../logger';
import { MemberAlreadySignedUp, MemberNotSignedUp } from '../../../../utils/errors';
import { MemberRepository } from '../../../member/member.repository';
import { AuthService } from '../../auth.service';

@singleton()
export class MobileService {
  private readonly log: BaseLogger;
  private readonly authService: AuthService;
  private readonly memberRepository: MemberRepository;

  constructor(authService: AuthService, memberRepository: MemberRepository, log: BaseLogger) {
    this.log = log;
    this.memberRepository = memberRepository;
    this.authService = authService;
  }

  async register(
    dbConnection: DBConnection,
    {
      name,
      email,
      challenge,
      enableSaveActions,
    }: {
      name: string;
      email: string;
      challenge: string;
      enableSaveActions?: boolean;
    },
    lang = DEFAULT_LANG,
  ) {
    // check if member w/ email already exists
    const member = await this.memberRepository.getByEmail(dbConnection, email);

    if (!member) {
      const data = {
        name,
        email,
        extra: { lang },
        enableSaveActions,
      };

      const newMember = await this.memberRepository.post(dbConnection, data);
      await this.authService.generateRegisterLinkAndEmailIt(newMember.toMemberInfo(), {
        challenge,
      });
    } else {
      this.log.warn(`Member re-registration attempt for email '${email}'`);
      await this.authService.generateLoginLinkAndEmailIt(member.toMemberInfo(), { challenge });
      throw new MemberAlreadySignedUp({ email });
    }
  }

  async login(
    dbConnection: DBConnection,
    { email, challenge }: { email: string; challenge: string },
  ) {
    const member = await this.memberRepository.getByEmail(dbConnection, email);

    if (member) {
      await this.authService.generateLoginLinkAndEmailIt(member.toMemberInfo(), { challenge });
    } else {
      this.log.warn(`Login attempt with non-existent email '${email}'`);
      throw new MemberNotSignedUp({ email });
    }
  }
}
