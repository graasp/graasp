import { singleton } from 'tsyringe';

import { DEFAULT_LANG } from '@graasp/translations';

import { BaseLogger } from '../../../../logger';
import { MemberAlreadySignedUp, MemberNotSignedUp } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { Actor } from '../../../member/entities/member';
import { AuthService } from '../../service';

@singleton()
export class MobileService {
  private readonly log: BaseLogger;
  private readonly authService: AuthService;

  constructor(authService: AuthService, log: BaseLogger) {
    this.log = log;
    this.authService = authService;
  }

  async register(
    actor: Actor,
    repositories: Repositories,
    {
      name,
      email,
      challenge,
      enableSaveActions,
    }: { name: string; email: string; challenge: string; enableSaveActions?: boolean },
    lang = DEFAULT_LANG,
  ) {
    const { memberRepository } = repositories;

    // check if member w/ email already exists
    const member = await memberRepository.getByEmail(email);

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
    actor: Actor,
    repositories: Repositories,
    { email, challenge }: { email: string; challenge: string },
  ) {
    const { memberRepository } = repositories;

    const member = await memberRepository.getByEmail(email);

    if (member) {
      await this.authService.generateLoginLinkAndEmailIt(member, { challenge });
    } else {
      this.log.warn(`Login attempt with non-existent email '${email}'`);
      throw new MemberNotSignedUp({ email });
    }
  }
}
