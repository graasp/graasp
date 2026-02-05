import { sign } from 'jsonwebtoken';
import { singleton } from 'tsyringe';

import {
  JWT_SECRET,
  LOGIN_TOKEN_EXPIRATION_IN_MINUTES,
  REGISTER_TOKEN_EXPIRATION_IN_MINUTES,
} from '../../config/secrets';
import { TRANSLATIONS } from '../../langs/constants';
import { BaseLogger } from '../../logger';
import { MailBuilder } from '../../plugins/mailer/builder';
import { MailerService } from '../../plugins/mailer/mailer.service';
import type { MemberInfo } from '../../types';
import { PUBLIC_URL } from '../../utils/config';
import { SHORT_TOKEN_PARAM } from './plugins/passport';
import { getRedirectionLink } from './utils';

@singleton()
export class AuthService {
  private readonly log: BaseLogger;
  private readonly mailerService: MailerService;

  constructor(mailerService: MailerService, log: BaseLogger) {
    this.mailerService = mailerService;
    this.log = log;
  }

  public async generateRegisterLinkAndEmailIt(
    member: MemberInfo,
    options: { challenge?: string; url?: string } = {},
  ): Promise<void> {
    const { challenge, url } = options;

    // generate token with member info and expiration
    const token = sign(
      { sub: member.id, challenge, emailValidation: true },
      JWT_SECRET,
      {
        expiresIn: `${REGISTER_TOKEN_EXPIRATION_IN_MINUTES}m`,
      },
    );

    const redirectionUrl = getRedirectionLink(this.log, url);
    const domain = PUBLIC_URL;
    const destination = new URL('/api/auth', domain);
    destination.searchParams.set(SHORT_TOKEN_PARAM, token);
    destination.searchParams.set('url', redirectionUrl);
    const link = destination.toString();

    const mail = new MailBuilder({
      subject: { text: TRANSLATIONS.SIGN_UP_TITLE },
      lang: member.lang,
    })
      .addText(TRANSLATIONS.GREETINGS)
      .addText(TRANSLATIONS.SIGN_UP_TEXT)
      .addButton(TRANSLATIONS.SIGN_UP_BUTTON_TEXT, link)
      .addUserAgreement()
      .addIgnoreEmailIfNotRequestedNotice()
      .build();

    // don't wait for mailerService's response; log error and link if it fails.
    this.mailerService
      .send(mail, member.email)
      .catch((err) =>
        this.log.warn(
          `mailerService failed with ${err.message}. link: ${link}`,
        ),
      );
  }

  public async generateLoginLinkAndEmailIt(
    member: MemberInfo,
    options: { challenge?: string; url?: string } = {},
  ): Promise<void> {
    const { challenge, url } = options;

    // generate token with member info and expiration
    const token = sign(
      { sub: member.id, challenge, emailValidation: true },
      JWT_SECRET,
      {
        expiresIn: `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
      },
    );

    const redirectionUrl = getRedirectionLink(this.log, url);
    const domain = PUBLIC_URL;
    const destination = new URL('/api/auth', domain);
    destination.searchParams.set(SHORT_TOKEN_PARAM, token);
    destination.searchParams.set('url', redirectionUrl);
    const link = destination.toString();

    const mail = new MailBuilder({
      subject: { text: TRANSLATIONS.SIGN_IN_TITLE },
      lang: member.lang,
    })
      .addText(TRANSLATIONS.SIGN_IN_TEXT)
      .addButton(TRANSLATIONS.SIGN_IN_BUTTON_TEXT, link)
      .addIgnoreEmailIfNotRequestedNotice()
      .build();

    // don't wait for mailerService's response; log error and link if it fails.
    this.mailerService
      .send(mail, member.email)
      .catch((err) =>
        this.log.warn(`mailerService failed: ${err.message}. link: ${link}`),
      );
  }
}
