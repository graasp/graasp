import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { promisify } from 'util';

import { FastifyBaseLogger } from 'fastify';

import { MAIL } from '@graasp/translations';

import {
  JWT_SECRET,
  LOGIN_TOKEN_EXPIRATION_IN_MINUTES,
  PUBLIC_URL,
  REGISTER_TOKEN_EXPIRATION_IN_MINUTES,
} from '../../utils/config';
import { Member } from '../member/entities/member';
import { getRedirectionUrl } from './utils';

const promisifiedJwtSign = promisify<
  { sub: string; challenge?: string },
  Secret,
  SignOptions,
  string
>(jwt.sign);

export class AuthService {
  log: FastifyBaseLogger;
  mailer: any; // TODO

  constructor(mailer, log) {
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
  ) => {
    const { challenge, url } = options;

    // generate token with member info and expiration
    const token = await promisifiedJwtSign({ sub: member.id, challenge }, JWT_SECRET, {
      expiresIn: `${REGISTER_TOKEN_EXPIRATION_IN_MINUTES}m`,
    });

    const redirectionUrl = getRedirectionUrl(url);
    const linkPath = challenge ? '/m/deep-link' : '/auth';
    const link = new URL(`${linkPath}?t=${token}&url=${redirectionUrl}`, PUBLIC_URL).toString();

    const lang = member.lang;

    const translated = this.mailer.translate(lang);
    const subject = translated(MAIL.SIGN_UP_TITLE);
    const html = `
    ${this.mailer.buildText(translated(MAIL.GREETINGS))}
    ${this.mailer.buildText(translated(MAIL.SIGN_UP_TEXT))}
    ${this.mailer.buildButton(link, translated(MAIL.SIGN_UP_BUTTON_TEXT))}
    ${this.mailer.buildText(translated(MAIL.SIGN_UP_NOT_REQUESTED))}`;

    // don't wait for mailer's response; log error and link if it fails.
    this.mailer
      .sendEmail(subject, member.email, link, html)
      .catch((err) => this.log.warn(err, `mailer failed. link: ${link}`));
  };

  generateLoginLinkAndEmailIt = async (
    member: Member,
    options: { challenge?: string; lang?: string; url?: string } = {},
  ) => {
    const { challenge, lang, url } = options;

    // generate token with member info and expiration
    const token = await promisifiedJwtSign({ sub: member.id, challenge }, JWT_SECRET, {
      expiresIn: `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
    });

    const redirectionUrl = getRedirectionUrl(url);
    const linkPath = challenge ? '/m/deep-link' : '/auth';
    const link = new URL(`${linkPath}?t=${token}&url=${redirectionUrl}`, PUBLIC_URL).toString();

    const memberLang = member.lang ?? lang;

    const translated = this.mailer.translate(memberLang);
    const subject = translated(MAIL.SIGN_IN_TITLE);
    const html = `
    ${this.mailer.buildText(translated(MAIL.SIGN_IN_TEXT))}
    ${this.mailer.buildButton(link, translated(MAIL.SIGN_IN_BUTTON_TEXT))}
    ${this.mailer.buildText(translated(MAIL.SIGN_IN_NOT_REQUESTED))}`;

    // don't wait for mailer's response; log error and link if it fails.
    this.mailer
      .sendEmail(subject, member.email, link, html)
      .catch((err) => this.log.warn(err, `mailer failed. link: ${link}`));
  };
}
