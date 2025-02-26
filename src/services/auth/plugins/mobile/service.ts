import { singleton } from 'tsyringe';

import { DEFAULT_LANG } from '@graasp/translations';

import { DBConnection } from '../../../../drizzle/db';
import { BaseLogger } from '../../../../logger';
import { MemberAlreadySignedUp, MemberNotSignedUp } from '../../../../utils/errors';
import { Actor } from '../../../member/entities/member';
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
    actor: Actor,
    {
      name,
      email,
      challenge,
      enableSaveActions,
    }: { name: string; email: string; challenge: string; enableSaveActions?: boolean },
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
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const newMember = await memberRepository.post(data);
      await this.authService.generateRegisterLinkAndEmailIt(newMember, { challenge });
    } else {
      this.log.warn(`Member re-registration attempt for email '${email}'`);
      await this.authService.generateLoginLinkAndEmailIt(member, { challenge });
      throw new MemberAlreadySignedUp({ email });
    }
  }

  async login(
    db: DBConnection,
    actor: Actor,
    { email, challenge }: { email: string; challenge: string },
  ) {
    const member = await this.memberRepository.getByEmail(db, email);

    if (member) {
      await this.authService.generateLoginLinkAndEmailIt(member, { challenge });
    } else {
      this.log.warn(`Login attempt with non-existent email '${email}'`);
      throw new MemberNotSignedUp({ email });
    }
  }
}
