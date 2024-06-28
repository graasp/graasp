import { Secret, SignOptions, sign } from 'jsonwebtoken';
import { promisify } from 'util';

import { FastifyBaseLogger } from 'fastify';

import { MailerDecoration } from '../../plugins/mailer';
import { MAIL } from '../../plugins/mailer/langs/constants';
import {
  JWT_SECRET,
  LOGIN_TOKEN_EXPIRATION_IN_MINUTES,
  MOBILE_AUTH_URL,
  PUBLIC_URL,
  REGISTER_TOKEN_EXPIRATION_IN_MINUTES,
} from '../../utils/config';
import { GRAASP_LANDING_PAGE_ORIGIN } from '../../utils/constants';
import { Repositories } from '../../utils/repositories';
import { Member } from '../member/entities/member';
import { SHORT_TOKEN_PARAM } from './plugins/passport';
import { getRedirectionUrl } from './utils';

const promisifiedJwtSign = promisify<
  { sub: string; challenge?: string },
  Secret,
  SignOptions,
  string
>(sign);

export class AuthService {
  log: FastifyBaseLogger;
  mailer: MailerDecoration;

  constructor(mailer: MailerDecoration, log: FastifyBaseLogger) {
    this.mailer = mailer;
    this.log = log;
  }

  generateToken(data, expiration) {
    return promisifiedJwtSign(data, JWT_SECRET, {
      expiresIn: expiration,
    });
  }

  generateRegisterLinkAndEmailIt = async (
    member: Member,
    options: { challenge?; url?: string } = {},
  ): Promise<void> => {
    const { challenge, url } = options;

    // generate token with member info and expiration
    const token = await promisifiedJwtSign({ sub: member.id, challenge }, JWT_SECRET, {
      expiresIn: `${REGISTER_TOKEN_EXPIRATION_IN_MINUTES}m`,
    });

    const redirectionUrl = getRedirectionUrl(this.log, url);
    const domain = challenge ? MOBILE_AUTH_URL : PUBLIC_URL;
    const destination = new URL('/auth', domain);
    destination.searchParams.set(SHORT_TOKEN_PARAM, token);
    destination.searchParams.set('url', encodeURIComponent(redirectionUrl));
    const link = destination.toString();

    const lang = member.lang;

    const translated = this.mailer.translate(lang);
    const subject = translated(MAIL.SIGN_UP_TITLE);
    const greetingsAndSignupText = `${translated(MAIL.GREETINGS)} ${translated(MAIL.SIGN_UP_TEXT)}`;
    const html = `
    ${this.mailer.buildText(greetingsAndSignupText)}
    ${this.mailer.buildButton(link, translated(MAIL.SIGN_UP_BUTTON_TEXT))}
    ${this.mailer.buildText(
      translated(MAIL.USER_AGREEMENTS_MAIL_TEXT, {
        signUpButtonText: translated(MAIL.SIGN_UP_BUTTON_TEXT),
        graaspLandingPageOrigin: GRAASP_LANDING_PAGE_ORIGIN,
      }),
      // Add margin top of -15px to remove 15px margin bottom of the button.
      { 'text-align': 'center', 'font-size': '10px', 'margin-top': '-15px' },
    )}
    ${this.mailer.buildText(translated(MAIL.SIGN_UP_NOT_REQUESTED))}`;

    const footer = this.mailer.buildFooter(lang);

    // don't wait for mailer's response; log error and link if it fails.
    this.mailer
      .sendEmail(subject, member.email, link, html, footer)
      .catch((err) => this.log.warn(err, `mailer failed. link: ${link}`));
  };

  generateLoginLinkAndEmailIt = async (
    member: Member,
    options: { challenge?: string; lang?: string; url?: string } = {},
  ): Promise<void> => {
    const { challenge, lang, url } = options;

    // generate token with member info and expiration
    const token = await promisifiedJwtSign({ sub: member.id, challenge }, JWT_SECRET, {
      expiresIn: `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
    });

    const redirectionUrl = getRedirectionUrl(this.log, url);
    const domain = challenge ? MOBILE_AUTH_URL : PUBLIC_URL;
    const destination = new URL('/auth', domain);
    destination.searchParams.set(SHORT_TOKEN_PARAM, token);
    destination.searchParams.set('url', encodeURIComponent(redirectionUrl));
    const link = destination.toString();

    const memberLang = member.lang ?? lang;

    const translated = this.mailer.translate(memberLang);
    const subject = translated(MAIL.SIGN_IN_TITLE);
    const html = `
    ${this.mailer.buildText(translated(MAIL.SIGN_IN_TEXT))}
    ${this.mailer.buildButton(link, translated(MAIL.SIGN_IN_BUTTON_TEXT))}
    ${this.mailer.buildText(translated(MAIL.SIGN_IN_NOT_REQUESTED))}`;

    const footer = this.mailer.buildFooter(lang);

    // don't wait for mailer's response; log error and link if it fails.
    this.mailer
      .sendEmail(subject, member.email, link, html, footer)
      .catch((err) => this.log.warn(err, `mailer failed. link: ${link}`));
  };

  async validateMemberId(repositories: Repositories, memberId: string): Promise<boolean> {
    return !!(await repositories.memberRepository.get(memberId));
  }
}
