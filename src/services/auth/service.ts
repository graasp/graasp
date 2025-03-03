import { sign } from 'jsonwebtoken';
import { singleton } from 'tsyringe';

import { TRANSLATIONS } from '../../langs/constants';
import { BaseLogger } from '../../logger';
import { MailBuilder } from '../../plugins/mailer/builder';
import { MailerService } from '../../plugins/mailer/mailer.service';
import { MinimalMember } from '../../types';
import {
  JWT_SECRET,
  LOGIN_TOKEN_EXPIRATION_IN_MINUTES,
  MOBILE_AUTH_URL,
  PUBLIC_URL,
  REGISTER_TOKEN_EXPIRATION_IN_MINUTES,
} from '../../utils/config';
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
    member: MinimalMember,
    options: { challenge?: string; url?: string } = {},
  ): Promise<void> {
    const { challenge, url } = options;

    // generate token with member info and expiration
    const token = sign({ sub: member.id, challenge, emailValidation: true }, JWT_SECRET, {
      expiresIn: `${REGISTER_TOKEN_EXPIRATION_IN_MINUTES}m`,
    });

    const redirectionUrl = getRedirectionLink(this.log, url);
    const domain = challenge ? MOBILE_AUTH_URL : PUBLIC_URL;
    const destination = new URL('/auth', domain);
    destination.searchParams.set(SHORT_TOKEN_PARAM, token);
    destination.searchParams.set('url', redirectionUrl);
    const link = destination.toString();

    const mail = new MailBuilder({
      subject: { text: TRANSLATIONS.SIGN_UP_TITLE },
      lang: member.extra.lang,
    })
      .addText(TRANSLATIONS.GREETINGS)
      .addText(TRANSLATIONS.SIGN_UP_TEXT)
      .addButton(TRANSLATIONS.SIGN_UP_BUTTON_TEXT, link)
      .addUserAgreement()
      .addIgnoreEmailIfNotRequestedNotice()
      .build();

    // HACK: member should always have ane mail set, but the db is not strict enough yet.
    if (!member.email) {
      return;
    }

    // don't wait for mailerService's response; log error and link if it fails.
    this.mailerService
      .send(mail, member.email)
      .catch((err) => this.log.warn(err, `mailerService failed. link: ${link}`));
  }

  generateLoginLinkAndEmailIt = async (
    member: Member,
    options: { challenge?: string; url?: string } = {},
  ): Promise<void> => {
    const { challenge, url } = options;

    // generate token with member info and expiration
    const token = sign({ sub: member.id, challenge, emailValidation: true }, JWT_SECRET, {
      expiresIn: `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
    });

    const redirectionUrl = getRedirectionLink(this.log, url);
    const domain = challenge ? MOBILE_AUTH_URL : PUBLIC_URL;
    const destination = new URL('/auth', domain);
    destination.searchParams.set(SHORT_TOKEN_PARAM, token);
    destination.searchParams.set('url', redirectionUrl);
    const link = destination.toString();

    const mail = new MailBuilder({
      subject: { text: TRANSLATIONS.SIGN_IN_TITLE },
      lang: member.extra.lang,
    })
      .addText(TRANSLATIONS.SIGN_IN_TEXT)
      .addButton(TRANSLATIONS.SIGN_IN_BUTTON_TEXT, link)
      .addIgnoreEmailIfNotRequestedNotice()
      .build();

    // HACK: member should always have ane mail set, but the db is not strict enough yet.
    if (!member.email) {
      return;
    }

    // don't wait for mailerService's response; log error and link if it fails.
    this.mailerService
      .send(mail, member.email)
      .catch((err) => this.log.warn(err, `mailerService failed. link: ${link}`));
  };
}
