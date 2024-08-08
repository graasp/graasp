import { Redis } from 'ioredis';
import { sign } from 'jsonwebtoken';
import { singleton } from 'tsyringe';
import { v4 as uuid } from 'uuid';

import { BaseLogger } from '../../../../logger';
import { MAIL } from '../../../../plugins/mailer/langs/constants';
import { MailerService } from '../../../../plugins/mailer/service';
import {
  AUTH_CLIENT_HOST,
  JWT_SECRET,
  PASSWORD_RESET_JWT_EXPIRATION_IN_MINUTES,
  PASSWORD_RESET_JWT_SECRET,
} from '../../../../utils/config';
import { MemberNotSignedUp, MemberWithoutPassword } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { Member } from '../../../member/entities/member';
import { SHORT_TOKEN_PARAM } from '../passport';
import { PasswordConflict } from './errors';
import { comparePasswords, encryptPassword } from './utils';

const REDIS_PREFIX = 'reset-password:';

@singleton()
export class MemberPasswordService {
  private readonly log: BaseLogger;
  private readonly mailerService: MailerService;
  private readonly redis: Redis;

  constructor(mailerService: MailerService, log: BaseLogger, redis: Redis) {
    this.mailerService = mailerService;
    this.log = log;
    this.redis = redis;
  }

  /**
   * Generate a Token with the member id and an optional challenge.
   * @param data The data to be included in the token.
   * @param expiration The expiration time of the token.
   * @returns A promise to be resolved with the generated token.
   */
  generateToken(data: { sub: string; challenge?: string }, expiration: string) {
    return sign(data, JWT_SECRET, {
      expiresIn: expiration,
    });
  }

  async post(actor: Member, repositories: Repositories, newPassword: string) {
    const { memberPasswordRepository } = repositories;
    // verify that input current password is the same as the stored one
    const currentPassword = await memberPasswordRepository.getForMemberId(actor.id);
    if (currentPassword) {
      throw new PasswordConflict();
    }
    // auto-generate a salt and a hash
    const newEncryptedPassword = await encryptPassword(newPassword);

    await memberPasswordRepository.post(actor.id, newEncryptedPassword);
  }

  async patch(
    actor: Member,
    repositories: Repositories,
    newPassword: string,
    currentPassword: string,
  ) {
    const { memberPasswordRepository } = repositories;
    // verify that input current password is the same as the stored one
    await memberPasswordRepository.validatePassword(actor.id, currentPassword);
    await memberPasswordRepository.patch(actor.id, newPassword);
  }

  /**
   * Modify the password of a member. Force the change without checking the current password.
   * Check if the Password Reset Request UUID is registered in the redis database.
   * If it is, delete it and change the password of the associated member.
   * @param repositories Object with the repositories needed to interact with the database. Must contain a memberPasswordRepository.
   * @param password New password.
   * @param uuid The Password Reset Request UUID associated to the member that wants to reset the password.
   * @returns void
   */
  async applyReset(repositories: Repositories, password: string, uuid: string): Promise<void> {
    const id = await this.redis.get(`${REDIS_PREFIX}${uuid}`);
    if (!id) {
      return;
    }
    await this.redis.del(uuid);
    const { memberPasswordRepository } = repositories;
    await memberPasswordRepository.patch(id, password);
  }

  /**
   * Create a password reset request.
   * Push a Password Reset Request UUID to the redis database with the member id as value.
   * If the email is not registered, do nothing. If the member doesn't have a password, do nothing.
   * Generate a JSON Web Token used for authentication.
   * The token will be valid for 24h, after that it will be deleted by the redis database.
   * The token contains an UUID, it is only used to identify the member on Redis Database.
   * @param repositories Object with the repositories needed to interact with the database. Must contain a memberRepository and a memberPasswordRepository.
   * @param email The email of the member that requested the password reset.
   * @returns The JSON Web Token to reset the password and the language of the member. Otherwise, undefined if the email is not registered or the member doesn't have a password.
   */
  async createResetPasswordRequest(
    repositories: Repositories,
    email: string,
  ): Promise<{ token: string; member: Member } | undefined> {
    const { memberRepository, memberPasswordRepository } = repositories;
    const member = await memberRepository.getByEmail(email);

    if (!member) {
      return;
    }
    const password = await memberPasswordRepository.getForMemberId(member.id);
    if (!password) {
      return;
    }
    const payload = { uuid: uuid() };
    const token = sign(payload, PASSWORD_RESET_JWT_SECRET, {
      expiresIn: `${PASSWORD_RESET_JWT_EXPIRATION_IN_MINUTES}m`,
    });
    this.redis.setex(
      `${REDIS_PREFIX}${payload.uuid}`,
      PASSWORD_RESET_JWT_EXPIRATION_IN_MINUTES * 60,
      member.id,
    );
    return { token, member };
  }

  /**
   * Send an email to the member with a link to reset their password.
   * The link targets to a frontend endpoint that will handle the password reset.
   * @param email The email of destination
   * @param token The JSON Web Token to reset the password.
   * @param lang The language to use for the email.
   * @returns void
   */
  mailResetPasswordRequest(email: string, token: string, lang: string): void {
    const translated = this.mailerService.translate(lang);
    const subject = translated(MAIL.RESET_PASSWORD_TITLE);
    // auth.graasp.org/reset-password?t=<token>
    const domain = AUTH_CLIENT_HOST;
    const destination = new URL('/reset-password', domain);
    destination.searchParams.set(SHORT_TOKEN_PARAM, token);
    const link = destination.toString();

    const html = `
      ${this.mailerService.buildText(translated(MAIL.RESET_PASSWORD_TEXT))}
      ${this.mailerService.buildButton(link, translated(MAIL.RESET_PASSWORD_BUTTON_TEXT))}
      ${this.mailerService.buildText(translated(MAIL.RESET_PASSWORD_NOT_REQUESTED))}`;

    const footer = this.mailerService.buildFooter(lang);

    // don't wait for mailerService's response; log error and link if it fails.
    this.mailerService
      .sendEmail(subject, email, link, html, footer)
      .catch((err) => this.log.warn(err, `mailerService failed. link: ${link}`));
  }

  /**
   * Check if the UUID is registered in the redis database as a Password Reset Request
   * @param uuid The UUID to check.
   * @returns True if the UUID is registered, false otherwise.
   */
  async validatePasswordResetUuid(uuid: string): Promise<boolean> {
    return (await this.redis.get(`${REDIS_PREFIX}${uuid}`)) !== null;
  }

  /**
   * Get the member associated to the Password Reset Request UUID registered in the redis database.
   * @param repositories Object with the repositories needed to interact with the database. Must contain a memberRepository.
   * @param uuid The Password Reset Request UUID
   * @returns The member associated to the UUID. Otherwise, undefined if we couldn't find the member.
   */
  async getMemberByPasswordResetUuid(
    repositories: Repositories,
    uuid: string,
  ): Promise<Member | undefined> {
    const id = await this.redis.get(`${REDIS_PREFIX}${uuid}`);
    if (!id) {
      return;
    }

    const { memberRepository } = repositories;
    return memberRepository.get(id);
  }

  /** Authenticate a member with email and password.
   * @param repositories Repositories needed to interact with the database. Must contain a memberRepository and a memberPasswordRepository.
   * @param email The email of the member that wants to authenticate.
   * @param password The password of the member that wants to authenticate.
   * @returns The member if the credentials are correct. Otherwise, undefined.
   * @throws MemberNotSignedUp if the email is not registered.
   * @throws MemberWithoutPassword if the member doesn't have a password.
   */
  async authenticate(
    repositories: Repositories,
    email: string,
    password: string,
  ): Promise<Member | undefined> {
    const { memberRepository, memberPasswordRepository } = repositories;
    // Check if the member is registered
    const member = await memberRepository.getByEmail(email);
    if (!member) {
      this.log.warn(`Login attempt with non-existent email '${email}'`);
      throw new MemberNotSignedUp({ email });
    }
    // Fetch the member's password
    const memberPassword = await memberPasswordRepository.getForMemberId(member.id);
    if (!memberPassword) {
      throw new MemberWithoutPassword();
    }
    // Validate credentials to build token
    if (await comparePasswords(password, memberPassword.password)) {
      return member;
    }
    return undefined;
  }

  async hasPassword(repositories: Repositories, memberId: string): Promise<boolean> {
    const { memberPasswordRepository } = repositories;
    const password = await memberPasswordRepository.getForMemberId(memberId);
    return Boolean(password);
  }
}
