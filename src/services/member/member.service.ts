import { sign as jwtSign } from 'jsonwebtoken';
import { singleton } from 'tsyringe';

import { ClientManager, Context, DEFAULT_LANG, type UUID } from '@graasp/sdk';

import {
  EMAIL_CHANGE_JWT_EXPIRATION_IN_MINUTES,
  EMAIL_CHANGE_JWT_SECRET,
} from '../../config/secrets';
import { type DBConnection } from '../../drizzle/db';
import type { MemberCreationDTO, MemberRaw } from '../../drizzle/types';
import { TRANSLATIONS } from '../../langs/constants';
import { BaseLogger } from '../../logger';
import { MailBuilder } from '../../plugins/mailer/builder';
import { MailerService } from '../../plugins/mailer/mailer.service';
import { type MemberInfo } from '../../types';
import { MemberAlreadySignedUp } from '../../utils/errors';
import { NEW_EMAIL_PARAM, SHORT_TOKEN_PARAM } from '../auth/plugins/passport';
import { MemberPasswordRepository } from '../auth/plugins/password/password.repository';
import { MemberRepository } from './member.repository';
import { MemberProfileRepository } from './plugins/profile/memberProfile.repository';

@singleton()
export class MemberService {
  private readonly mailerService: MailerService;
  private readonly log: BaseLogger;
  private readonly memberRepository: MemberRepository;
  private readonly memberPasswordRepository: MemberPasswordRepository;
  private readonly memberProfileRepository: MemberProfileRepository;

  constructor(
    mailerService: MailerService,
    log: BaseLogger,
    memberRepository: MemberRepository,
    memberPasswordRepository: MemberPasswordRepository,
    memberProfileRepository: MemberProfileRepository,
  ) {
    this.mailerService = mailerService;
    this.memberRepository = memberRepository;
    this.memberPasswordRepository = memberPasswordRepository;
    this.memberProfileRepository = memberProfileRepository;
    this.log = log;
  }

  async get(dbConnection: DBConnection, id: string) {
    return this.memberRepository.get(dbConnection, id);
  }

  async getByEmail(dbConnection: DBConnection, email: string) {
    return await this.memberRepository.getByEmail(dbConnection, email);
  }

  async getMany(dbConnection: DBConnection, ids: string[]) {
    return this.memberRepository.getMany(dbConnection, ids);
  }

  async getManyByEmails(dbConnection: DBConnection, emails: string[]) {
    return this.memberRepository.getManyByEmails(
      dbConnection,
      emails.map((email) => email.trim().toLowerCase()),
    );
  }

  async post(
    dbConnection: DBConnection,
    body: Partial<MemberCreationDTO> & Pick<MemberCreationDTO, 'email' | 'name'>,
    lang = DEFAULT_LANG,
  ) {
    // The email is lowercased when the user registers
    // To every subsequents call, it is to the client to ensure the email is sent in lowercase
    // the servers always do a 1:1 match to retrieve the member by email.
    const email = body.email.toLowerCase();

    // check if member w/ email already exists
    const member = await this.memberRepository.getByEmail(dbConnection, email);

    if (!member) {
      const newMember = {
        ...body,
        extra: { lang },
      };

      const member = await this.memberRepository.post(dbConnection, newMember);

      return member;
    } else {
      throw new MemberAlreadySignedUp({ email });
    }
  }

  async patch(
    dbConnection: DBConnection,
    id: UUID,
    body: Partial<Pick<MemberRaw, 'extra' | 'email' | 'name' | 'enableSaveActions'>>,
  ) {
    return this.memberRepository.patch(dbConnection, id, {
      name: body.name,
      email: body.email,
      extra: body?.extra,
      enableSaveActions: body.enableSaveActions,
    });
  }

  async deleteCurrent(memberId: string, dbConnection: DBConnection) {
    await this.memberRepository.deleteOne(dbConnection, memberId);
  }

  async deleteOne(dbConnection: DBConnection, id: UUID) {
    return this.memberRepository.deleteOne(dbConnection, id);
  }

  async refreshLastAuthenticatedAt(dbConnection: DBConnection, id: UUID) {
    return await this.memberRepository.patch(dbConnection, id, {
      lastAuthenticatedAt: new Date().toISOString(),
    });
  }
  async validate(dbConnection: DBConnection, id: UUID) {
    return await this.memberRepository.patch(dbConnection, id, { isValidated: true });
  }

  createEmailChangeRequest(member: MemberInfo, newEmail: string) {
    const payload = { uuid: member.id, oldEmail: member.email, newEmail };
    return jwtSign(payload, EMAIL_CHANGE_JWT_SECRET, {
      expiresIn: `${EMAIL_CHANGE_JWT_EXPIRATION_IN_MINUTES}m`,
    });
  }

  /**
   * Send an email to the member with a link to reset their password.
   * The link targets to a frontend endpoint that will handle the password reset.
   * @param email The email of destination
   * @param token The JSON Web Token to reset the password.
   * @param lang The language to use for the email.
   * @returns void
   */
  sendEmailChangeRequest(newEmail: string, token: string, lang: string): void {
    const destination = ClientManager.getInstance().getURLByContext(
      Context.Account,
      '/email/change',
    );
    destination.searchParams.set(SHORT_TOKEN_PARAM, token);
    destination.searchParams.set(NEW_EMAIL_PARAM, newEmail);
    const link = destination.toString();

    const mail = new MailBuilder({
      subject: { text: TRANSLATIONS.CHANGE_EMAIL_TITLE },
      lang: lang,
    })
      .addText(TRANSLATIONS.CHANGE_EMAIL_TEXT)
      .addButton(TRANSLATIONS.CHANGE_EMAIL_BUTTON_TEXT, link)
      .addIgnoreEmailIfNotRequestedNotice()
      .build();

    // don't wait for mailer's response; log error and link if it fails.
    this.mailerService
      .send(mail, newEmail)
      .catch((err) => this.log.warn(err, `mailer failed. link: ${link}`));
  }

  mailConfirmEmailChangeRequest(oldEmail: string, newEmail: string, lang: string) {
    const mail = new MailBuilder({
      subject: { text: TRANSLATIONS.CONFIRM_CHANGE_EMAIL_TITLE },
      lang: lang,
    })
      .addText(TRANSLATIONS.CONFIRM_CHANGE_EMAIL_TEXT, { newEmail })
      .build();

    // don't wait for mailer's response; log error and link if it fails.
    this.mailerService.send(mail, oldEmail).catch((err) => this.log.warn(err, `mailer failed.`));
  }

  emailSubscribe(dbConnection: DBConnection, memberId: string, shouldSubscribe: boolean) {
    return this.memberRepository.updateEmailSubscribedAt(dbConnection, memberId, shouldSubscribe);
  }

  async getSettings(dbConnection: DBConnection, memberId: string) {
    const member = (await this.memberRepository.get(dbConnection, memberId)).toCurrent();

    return {
      enableSaveActions: member.enableSaveActions,
      notificationFrequency: member.extra.emailFreq ?? 'always',
      communicationSubscribedAt: member.communicationSubscribedAt,
      lang: member.extra.lang,
    };
  }
}
