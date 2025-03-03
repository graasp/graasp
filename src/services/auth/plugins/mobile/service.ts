import { singleton } from 'tsyringe';

import { DEFAULT_LANG } from '@graasp/translations';

import { DBConnection } from '../../../../drizzle/db';
import { BaseLogger } from '../../../../logger';
import { MinimalMember } from '../../../../types';
import { MemberAlreadySignedUp, MemberNotSignedUp } from '../../../../utils/errors';
import { MemberRepository } from '../../../member/repository';
import { AuthService } from '../../service';

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
    db: DBConnection,
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
    const member = await this.memberRepository.getByEmail(db, email);

    if (!member) {
      const data = {
        name,
        email,
        extra: { lang },
        enableSaveActions,
      };

      const newMember = (await this.memberRepository.post(db, data)) satisfies MinimalMember;
      await this.authService.generateRegisterLinkAndEmailIt(newMember, {
        challenge,
      });
    } else {
      this.log.warn(`Member re-registration attempt for email '${email}'`);
      await this.authService.generateLoginLinkAndEmailIt(member, { challenge });
      throw new MemberAlreadySignedUp({ email });
    }
  }

  async login(db: DBConnection, { email, challenge }: { email: string; challenge: string }) {
    const member = await this.memberRepository.getByEmail(db, email);

    if (member) {
      await this.authService.generateLoginLinkAndEmailIt(member, { challenge });
    } else {
      this.log.warn(`Login attempt with non-existent email '${email}'`);
      throw new MemberNotSignedUp({ email });
    }
  }
}
