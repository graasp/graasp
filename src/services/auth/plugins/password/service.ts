import { Redis } from 'ioredis';
import { sign } from 'jsonwebtoken';
import { singleton } from 'tsyringe';
import { v4 as uuid } from 'uuid';

import { ClientManager, Context } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { Member } from '../../../../drizzle/schema';
import { TRANSLATIONS } from '../../../../langs/constants';
import { BaseLogger } from '../../../../logger';
import { MailBuilder } from '../../../../plugins/mailer/builder';
import { MailerService } from '../../../../plugins/mailer/mailer.service';
import {
  JWT_SECRET,
  PASSWORD_RESET_JWT_EXPIRATION_IN_MINUTES,
  PASSWORD_RESET_JWT_SECRET,
} from '../../../../utils/config';
import { MemberNotSignedUp, MemberWithoutPassword } from '../../../../utils/errors';
import { Account } from '../../../account/entities/account';
import { MemberRepository } from '../../../member/repository';
import { SHORT_TOKEN_PARAM } from '../passport';
import { PasswordConflict } from './errors';
import { MemberPasswordRepository } from './repository';
import { comparePasswords, encryptPassword } from './utils';

const REDIS_PREFIX = 'reset-password:';

@singleton()
export class MemberPasswordService {
  private readonly log: BaseLogger;
  private readonly mailerService: MailerService;
  private readonly redis: Redis;
  private readonly memberRepository: MemberRepository;
  private readonly memberPasswordRepository: MemberPasswordRepository;

  constructor(
    mailerService: MailerService,
    log: BaseLogger,
    redis: Redis,
    memberRepository: MemberRepository,
    memberPasswordRepository: MemberPasswordRepository,
  ) {
    this.mailerService = mailerService;
    this.log = log;
    this.redis = redis;
    this.memberRepository = memberRepository;
    this.memberPasswordRepository = memberPasswordRepository;
  }

  /**
   * Get the key to use to store the password reset request in Redis
   * @param uuid uuid of the reset request
   * @returns The redis key to use for storing password reset requests in redis
   */
  buildRedisKey(uuid: string) {
    return `${REDIS_PREFIX}${uuid}`;
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

  async post(db: DBConnection, actor: Account, newPassword: string) {
    // verify that input current password is the same as the stored one
    const currentPassword = await this.memberPasswordRepository.getForMemberId(db, actor.id);
    if (currentPassword) {
      throw new PasswordConflict();
    }
    // auto-generate a salt and a hash
    const newEncryptedPassword = await encryptPassword(newPassword);

    await this.memberPasswordRepository.post(db, actor.id, newEncryptedPassword);
  }

  async patch(db: DBConnection, account: Account, newPassword: string, currentPassword: string) {
    // verify that input current password is the same as the stored one
    await this.memberPasswordRepository.validatePassword(db, account.id, currentPassword);
    await this.memberPasswordRepository.patch(db, account.id, newPassword);
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
  async applyReset(db: DBConnection, password: string, uuid: string): Promise<void> {
    const id = await this.redis.get(this.buildRedisKey(uuid));
    if (!id) {
      return;
    }
    await this.redis.del(this.buildRedisKey(uuid));
    await this.memberPasswordRepository.patch(db, id, password);
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
    db: DBConnection,
    email: string,
  ): Promise<{ token: string; member: Member } | undefined> {
    const member = await this.memberRepository.getByEmail(db, email);

    if (!member) {
      return;
    }
    const password = await this.memberPasswordRepository.getForMemberId(db, member.id);
    if (!password) {
      return;
    }
    const payload = { uuid: uuid() };
    const token = sign(payload, PASSWORD_RESET_JWT_SECRET, {
      expiresIn: `${PASSWORD_RESET_JWT_EXPIRATION_IN_MINUTES}m`,
    });
    this.redis.setex(
      this.buildRedisKey(payload.uuid),
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
    // auth.graasp.org/reset-password?t=<token>
    const destinationUrl = ClientManager.getInstance().getLinkByContext(
      Context.Auth,
      'reset-password',
      {
        [SHORT_TOKEN_PARAM]: token,
      },
    );

    const mail = new MailBuilder({
      subject: { text: TRANSLATIONS.RESET_PASSWORD_TITLE },
      lang,
    })
      .addText(TRANSLATIONS.RESET_PASSWORD_TEXT)
      .addButton(TRANSLATIONS.RESET_PASSWORD_BUTTON_TEXT, destinationUrl)
      .addIgnoreEmailIfNotRequestedNotice()
      .build();

    // don't wait for mailerService's response; log error and link if it fails.
    this.mailerService
      .send(mail, email)
      .catch((err) => this.log.warn(err, `mailerService failed. link: ${destinationUrl}`));
  }

  /**
   * Check if the UUID is registered in the redis database as a Password Reset Request
   * @param uuid The UUID to check.
   * @returns True if the UUID is registered, false otherwise.
   */
  async validatePasswordResetUuid(uuid: string): Promise<boolean> {
    return (await this.redis.get(this.buildRedisKey(uuid))) !== null;
  }

  /**
   * Get the member associated to the Password Reset Request UUID registered in the redis database.
   * @param repositories Object with the repositories needed to interact with the database. Must contain a memberRepository.
   * @param uuid The Password Reset Request UUID
   * @returns The member associated to the UUID. Otherwise, undefined if we couldn't find the member.
   */
  async getMemberByPasswordResetUuid(db: DBConnection, uuid: string): Promise<Member> {
    const id = await this.redis.get(this.buildRedisKey(uuid));
    if (!id) {
      throw new Error('Id not found');
    }
    return this.memberRepository.get(db, id);
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
    db: DBConnection,
    email: string,
    password: string,
  ): Promise<Member | undefined> {
    // Check if the member is registered
    const member = await this.memberRepository.getByEmail(db, email);
    if (!member) {
      this.log.warn(`Login attempt with non-existent email '${email}'`);
      throw new MemberNotSignedUp({ email });
    }
    // Fetch the member's password
    const memberPassword = await this.memberPasswordRepository.getForMemberId(db, member.id);
    if (!memberPassword) {
      throw new MemberWithoutPassword();
    }
    // Validate credentials to build token
    if (await comparePasswords(password, memberPassword.password)) {
      return member;
    }
    return undefined;
  }

  async hasPassword(db: DBConnection, memberId: string): Promise<boolean> {
    const password = await this.memberPasswordRepository.getForMemberId(db, memberId);
    return Boolean(password);
  }
}
