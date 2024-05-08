import Redis from 'ioredis';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { promisify } from 'util';

import { FastifyBaseLogger } from 'fastify';

import { MailerDecoration } from '../../../../plugins/mailer';
import { MAIL } from '../../../../plugins/mailer/langs/constants';
import {
  AUTH_TOKEN_JWT_SECRET,
  JWT_SECRET,
  LOGIN_TOKEN_EXPIRATION_IN_MINUTES,
  PASSWORD_RESET_JWT_EXPIRATION_IN_MINUTES,
  PUBLIC_URL,
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_USERNAME,
} from '../../../../utils/config';
import { MemberNotSignedUp, MemberWithoutPassword } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { Member } from '../../../member/entities/member';
import { MemberPasswordRepository } from './repository';

const REDIS_PREFIX = 'reset-password:';

const promisifiedJwtSign = promisify<
  { sub: string; challenge?: string },
  Secret,
  SignOptions,
  string
>(jwt.sign);

export class MemberPasswordService {
  log: FastifyBaseLogger;
  mailer: MailerDecoration;
  redis: Redis;

  constructor(mailer, log) {
    this.mailer = mailer;
    this.log = log;

    this.redis = new Redis({
      host: REDIS_HOST,
      port: parseInt(REDIS_PORT ?? '6379'),
      username: REDIS_USERNAME,
      password: REDIS_PASSWORD,
    });
  }

  generateToken(data, expiration) {
    return promisifiedJwtSign(data, JWT_SECRET, {
      expiresIn: expiration,
    });
  }

  async patch(
    actor: Member,
    repositories: Repositories,
    newPassword: string,
    currentPassword?: string,
  ) {
    const { memberPasswordRepository } = repositories;
    // verify that input current password is the same as the stored one
    await memberPasswordRepository.validatePassword(actor.id, currentPassword);
    await memberPasswordRepository.patch(actor.id, newPassword);
  }

  /**
   * Modify the password of a member. Force the change without checking the current password.
   * Check if the token is registered in the redis database. If it is, delete it and change the password of the associated member.
   * @param repositories Object with the repositories needed to interact with the database. Must contain a memberPasswordRepository.
   * @param password New password.
   * @param token The JSON Web Token associated to the member that wants to reset the password.
   * @returns void
   */
  async forcePatch(repositories: Repositories, password: string, token: string): Promise<void> {
    const id = await this.redis.get(`${REDIS_PREFIX}${token}`);
    if (!id) return;
    await this.redis.del(token);
    const { memberPasswordRepository } = repositories;
    await memberPasswordRepository.patch(id, password);
  }

  /**
   * Create a password reset request.
   * Push a JSON Web Token to the redis database with the member id as value.
   * If the email is not registered, do nothing. If the member doesn't have a password, do nothing.
   * The token will be valid for 24h, after that it will be deleted by the redis database.
   * The token contains an empty payload, it is only used to identify the member.
   * @param repositories Object with the repositories needed to interact with the database. Must contain a memberRepository and a memberPasswordRepository.
   * @param email The email of the member that requested the password reset.
   * @returns The JSON Web Token to reset the password and the language of the member. Otherwise, undefined if the email is not registered or the member doesn't have a password.
   */
  async createResetPasswordRequest(
    repositories: Repositories,
    email: string,
  ): Promise<{ token: string; lang: string } | undefined> {
    const { memberRepository } = repositories;
    const member: Member = await memberRepository.getByEmail(email);
    if (member) {
      if ((await MemberPasswordRepository.getForMemberId(member.id)) === undefined) return;
      const payload = {};
      const token = jwt.sign(payload, AUTH_TOKEN_JWT_SECRET);
      this.redis.setex(token, PASSWORD_RESET_JWT_EXPIRATION_IN_MINUTES * 60, member.id);
    this.redis.setex(
      `${REDIS_PREFIX}${token}`,
      PASSWORD_RESET_JWT_EXPIRATION_IN_MINUTES * 60,
      member.id,
    );
  }

  /**
   * Send an email to the member with a link to reset their password.
   * The link target to a frontend endpoint that will handle the password reset.
   * @param email The email of destination
   * @param token The JSON Web Token to reset the password.
   * @param memberLang The language to use for the email.
   * @returns void
   */
  mailResetPasswordRequest(email: string, token: string, lang: string): void {
    const translated = this.mailer.translate(lang);
    const subject = translated(MAIL.RESET_PASSWORD_TITLE);
    // auth.graasp.org/reset-password?t=<token>
    const domain = AUTH_CLIENT_HOST;
    const destination = new URL('/reset-password', domain);
    destination.searchParams.set('t', token);
    const link = destination.toString();

    const html = `
      ${this.mailer.buildText(translated(MAIL.RESET_PASSWORD_TEXT))}
      ${this.mailer.buildButton(link, translated(MAIL.RESET_PASSWORD_BUTTON_TEXT))}
      ${this.mailer.buildText(translated(MAIL.RESET_PASSWORD_NOT_REQUESTED))}`;

    const footer = this.mailer.buildFooter(lang);

    // don't wait for mailer's response; log error and link if it fails.
    this.mailer
      .sendEmail(subject, email, link, html, footer)
      .catch((err) => this.log.warn(err, `mailer failed. link: ${link}`));
  }

  /**
   * Check if the JSON Web Token is registered in the redis database.
   * @param token The token to check.
   * @returns True if the token is registered, false otherwise.
   */
  async validateResetPasswordToken(token: string): Promise<boolean> {
    return (await this.redis.get(`${REDIS_PREFIX}${token}`)) !== null;
  }

  /**
   *
   * @param actor
   * @param repositories
   * @param body
   * @param challenge  used for mobile
   * @returns
   */
  async login(
    actor: undefined,
    repositories: Repositories,
    body: { email: string; password: string },
    challenge?: string,
  ) {
    const { memberRepository, memberPasswordRepository } = repositories;
    const { email } = body;

    const member = await memberRepository.getByEmail(email);
    if (!member) {
      this.log.warn(`Login attempt with non-existent email '${email}'`);
      throw new MemberNotSignedUp({ email });
    }

    const memberPassword = await memberPasswordRepository.getForMemberId(member.id);
    if (!memberPassword) {
      throw new MemberWithoutPassword({ email });
    }

    // validate credentials to build token
    await memberPasswordRepository.validateCredentials(memberPassword, body);

    const token = await this.generateToken(
      { sub: member.id, challenge },
      `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
    );

    return token;
  }
}
