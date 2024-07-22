import { sign } from 'jsonwebtoken';
import { singleton } from 'tsyringe';

import { BaseLogger } from '../../logger';
import { MAIL } from '../../plugins/mailer/langs/constants';
import { MailerService } from '../../plugins/mailer/service';
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
    destination.searchParams.set('url', encodeURIComponent(redirectionUrl));
    const link = destination.toString();

    const lang = member.lang;

    const translated = this.mailerService.translate(lang);
    const subject = translated(MAIL.SIGN_UP_TITLE);
    const greetingsAndSignupText = `${translated(MAIL.GREETINGS)} ${translated(MAIL.SIGN_UP_TEXT)}`;
    const html = `
    ${this.mailerService.buildText(greetingsAndSignupText)}
    ${this.mailerService.buildButton(link, translated(MAIL.SIGN_UP_BUTTON_TEXT))}
    ${this.mailerService.buildText(
      translated(MAIL.USER_AGREEMENTS_MAIL_TEXT, {
        signUpButtonText: translated(MAIL.SIGN_UP_BUTTON_TEXT),
        graaspLandingPageOrigin: GRAASP_LANDING_PAGE_ORIGIN,
      }),
      // Add margin top of -15px to remove 15px margin bottom of the button.
      { 'text-align': 'center', 'font-size': '10px', 'margin-top': '-15px' },
    )}
    ${this.mailerService.buildText(translated(MAIL.SIGN_UP_NOT_REQUESTED))}`;

    const footer = this.mailerService.buildFooter(lang);

    // don't wait for mailerService's response; log error and link if it fails.
    this.mailerService
      .sendEmail(subject, member.email, link, html, footer)
      .catch((err) => this.log.warn(err, `mailerService failed. link: ${link}`));
  };

  generateLoginLinkAndEmailIt = async (
    member: Member,
    options: { challenge?: string; lang?: string; url?: string } = {},
  ): Promise<void> => {
    const { challenge, lang, url } = options;

    // generate token with member info and expiration
    const token = sign({ sub: member.id, challenge, emailValidation: true }, JWT_SECRET, {
      expiresIn: `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
    });

    const redirectionUrl = getRedirectionUrl(this.log, url);
    const domain = challenge ? MOBILE_AUTH_URL : PUBLIC_URL;
    const destination = new URL('/auth', domain);
    destination.searchParams.set(SHORT_TOKEN_PARAM, token);
    destination.searchParams.set('url', encodeURIComponent(redirectionUrl));
    const link = destination.toString();

    const memberLang = member.lang ?? lang;

    const translated = this.mailerService.translate(memberLang);
    const subject = translated(MAIL.SIGN_IN_TITLE);
    const html = `
    ${this.mailerService.buildText(translated(MAIL.SIGN_IN_TEXT))}
    ${this.mailerService.buildButton(link, translated(MAIL.SIGN_IN_BUTTON_TEXT))}
    ${this.mailerService.buildText(translated(MAIL.SIGN_IN_NOT_REQUESTED))}`;

    const footer = this.mailerService.buildFooter(lang);

    // don't wait for mailerService's response; log error and link if it fails.
    this.mailerService
      .sendEmail(subject, member.email, link, html, footer)
      .catch((err) => this.log.warn(err, `mailerService failed. link: ${link}`));
  };

  async validateMemberId(repositories: Repositories, memberId: string): Promise<boolean> {
    return !!(await repositories.memberRepository.get(memberId));
  }
}
