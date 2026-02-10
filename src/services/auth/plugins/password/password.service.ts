import { Redis } from 'ioredis';
import { type SignOptions, sign } from 'jsonwebtoken';
import { singleton } from 'tsyringe';
import { v4 as uuid } from 'uuid';

import { ClientManager, Context } from '@graasp/sdk';

import {
  JWT_SECRET,
  PASSWORD_RESET_JWT_EXPIRATION_IN_MINUTES,
  PASSWORD_RESET_JWT_SECRET,
} from '../../../../config/secrets';
import { type DBConnection } from '../../../../drizzle/db';
import { TRANSLATIONS } from '../../../../langs/constants';
import { BaseLogger } from '../../../../logger';
import { MailBuilder } from '../../../../plugins/mailer/builder';
import { MailerService } from '../../../../plugins/mailer/mailer.service';
import type { AuthenticatedUser, MemberInfo } from '../../../../types';
import {
  BadCredentials,
  EmptyCurrentPassword,
  InvalidPassword,
  MemberNotSignedUp,
  MemberWithoutPassword,
} from '../../../../utils/errors';
import { MemberRepository } from '../../../member/member.repository';
import { MemberDTO } from '../../../member/types';
import { SHORT_TOKEN_PARAM } from '../passport';
import { PasswordConflict } from './errors';
import { MemberPasswordRepository } from './password.repository';
import { comparePasswords, encryptPassword, verifyCurrentPassword } from './utils';

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
  generateToken(data: { sub: string; challenge?: string }, expiration: SignOptions['expiresIn']) {
    return sign(data, JWT_SECRET, {
      expiresIn: expiration,
    });
  }

  async post(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    newPassword: string,
  ) {
    // verify that input current password is the same as the stored one
    const currentPassword = await this.memberPasswordRepository.getForMemberId(
      dbConnection,
      authenticatedUser.id,
    );
    if (currentPassword) {
      throw new PasswordConflict();
    }
    // auto-generate a salt and a hash
    const newEncryptedPassword = await encryptPassword(newPassword);

    await this.memberPasswordRepository.post(
      dbConnection,
      authenticatedUser.id,
      newEncryptedPassword,
    );
  }

  async patch(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    newPassword: string,
    currentPassword: string,
  ) {
    // get member stored password
    const memberPassword = await this.memberPasswordRepository.getForMemberId(
      dbConnection,
      authenticatedUser.id,
    );

    // Check if password can be updated
    // member has a password, we must check if passwords match before updating
    if (memberPassword) {
      const verified = await verifyCurrentPassword(memberPassword.password, currentPassword);
      // throw error if password verification fails
      if (!verified) {
        // this should be validated by the schema, but we do it again here.
        if (currentPassword === '') {
          throw new EmptyCurrentPassword();
        }
        throw new InvalidPassword();
      }
    }
    // apply password change
    await this.memberPasswordRepository.put(dbConnection, authenticatedUser.id, newPassword);
  }

  /**
   * Modify the password of a member. Force the change without checking the current password.
   * Check if the Password Reset Request UUID is registered in the redis database.
   * If it is, delete it and change the password of the associated member.
   * @param dbConnection current connection to the database
   * @param password New password.
   * @param uuid The Password Reset Request UUID associated to the member that wants to reset the password.
   * @returns void
   */
  async applyReset(dbConnection: DBConnection, password: string, uuid: string): Promise<void> {
    const id = await this.redis.get(this.buildRedisKey(uuid));
    if (!id) {
      return;
    }
    await this.redis.del(this.buildRedisKey(uuid));
    await this.memberPasswordRepository.put(dbConnection, id, password);
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
    dbConnection: DBConnection,
    email: string,
  ): Promise<{ token: string; member: MemberInfo } | undefined> {
    const member = await this.memberRepository.getByEmail(dbConnection, email);
    if (!member) {
      return;
    }
    const password = await this.memberPasswordRepository.getForMemberId(dbConnection, member.id);
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
    return { token, member: member.toMemberInfo() };
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
      .catch((err) =>
        this.log.warn(`mailerService failed with: ${err.message}. link: ${destinationUrl}`),
      );
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
  async getMemberByPasswordResetUuid(dbConnection: DBConnection, uuid: string): Promise<MemberDTO> {
    const id = await this.redis.get(this.buildRedisKey(uuid));
    if (!id) {
      throw new Error('Id not found');
    }
    const member = await this.memberRepository.get(dbConnection, id);
    return member;
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
    dbConnection: DBConnection,
    email: string,
    password: string,
  ): Promise<MemberDTO | undefined> {
    // Check if the member is registered
    const member = await this.memberRepository.getByEmail(dbConnection, email);
    if (!member) {
      this.log.warn(`Login attempt with non-existent email '${email}'`);
      throw new MemberNotSignedUp({ email });
    }
    // Fetch the member's password
    const memberPassword = await this.memberPasswordRepository.getForMemberId(
      dbConnection,
      member.id,
    );
    if (!memberPassword) {
      throw new MemberWithoutPassword();
    }
    // Validate credentials to build token
    if (await comparePasswords(password, memberPassword.password)) {
      return member;
    }

    throw new BadCredentials();
  }

  async hasPassword(dbConnection: DBConnection, memberId: string): Promise<boolean> {
    const password = await this.memberPasswordRepository.getForMemberId(dbConnection, memberId);
    return Boolean(password);
  }
}
