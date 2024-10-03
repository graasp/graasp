import { sign } from 'jsonwebtoken';
import { singleton } from 'tsyringe';

import { BaseLogger } from '../../logger';
import { MailBuilder } from '../../plugins/mailer/builder';
import { MAIL } from '../../plugins/mailer/langs/constants';
import { MailerService } from '../../plugins/mailer/service';
import {
  JWT_SECRET,
  LOGIN_TOKEN_EXPIRATION_IN_MINUTES,
  MOBILE_AUTH_URL,
  PUBLIC_URL,
  REGISTER_TOKEN_EXPIRATION_IN_MINUTES,
} from '../../utils/config';
import { Repositories } from '../../utils/repositories';
import { Member } from '../member/entities/member';
import { SHORT_TOKEN_PARAM } from './plugins/passport';
import { getRedirectionUrl } from './utils';

@singleton()
export class AuthService {
  private readonly log: BaseLogger;
  private readonly mailerService: MailerService;

  constructor(mailerService: MailerService, log: BaseLogger) {
    this.mailerService = mailerService;
    this.log = log;
  }

  generateRegisterLinkAndEmailIt = async (
    member: Member,
    options: { challenge?: string; url?: string } = {},
  ): Promise<void> => {
    const { challenge, url } = options;

    // generate token with member info and expiration
    const token = sign({ sub: member.id, challenge, emailValidation: true }, JWT_SECRET, {
      expiresIn: `${REGISTER_TOKEN_EXPIRATION_IN_MINUTES}m`,
    });

    const redirectionUrl = getRedirectionUrl(this.log, url);
    const domain = challenge ? MOBILE_AUTH_URL : PUBLIC_URL;
    const destination = new URL('/auth', domain);
    destination.searchParams.set(SHORT_TOKEN_PARAM, token);
    destination.searchParams.set('url', redirectionUrl);
    const link = destination.toString();

    const mail = new MailBuilder({
      subject: MAIL.SIGN_UP_TITLE,
      translationVariables: {},
      lang: member.lang,
    })
      .addText(MAIL.GREETINGS)
      .addText(MAIL.SIGN_UP_TEXT)
      .addButton(MAIL.SIGN_UP_BUTTON_TEXT, link)
      .includeUserAgreement()
      .signUpNotRequested()
      .build();

    // don't wait for mailerService's response; log error and link if it fails.
    this.mailerService
      .send(mail, member.email)
      .catch((err) => this.log.warn(err, `mailerService failed. link: ${link}`));
  };

  generateLoginLinkAndEmailIt = async (
    member: Member,
    options: { challenge?: string; lang?: string; url?: string } = {},
  ): Promise<void> => {
    const { challenge, url } = options;

    // generate token with member info and expiration
    const token = sign({ sub: member.id, challenge, emailValidation: true }, JWT_SECRET, {
      expiresIn: `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
    });

    const redirectionUrl = getRedirectionUrl(this.log, url);
    const domain = challenge ? MOBILE_AUTH_URL : PUBLIC_URL;
    const destination = new URL('/auth', domain);
    destination.searchParams.set(SHORT_TOKEN_PARAM, token);
    destination.searchParams.set('url', redirectionUrl);
    const link = destination.toString();

    const mail = new MailBuilder({
      subject: MAIL.SIGN_IN_TITLE,
      translationVariables: {},
      lang: member.lang,
    })
      .addText(MAIL.SIGN_IN_TEXT)
      .addButton(MAIL.SIGN_IN_BUTTON_TEXT, link)
      .signUpNotRequested()
      .build();

    // don't wait for mailerService's response; log error and link if it fails.
    this.mailerService
      .send(mail, member.email)
      .catch((err) => this.log.warn(err, `mailerService failed. link: ${link}`));
  };

  async validateMemberId(repositories: Repositories, memberId: string): Promise<boolean> {
    return !!(await repositories.memberRepository.get(memberId));
  }
}
