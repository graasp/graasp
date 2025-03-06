import { sign as jwtSign } from 'jsonwebtoken';
import { singleton } from 'tsyringe';

import { ClientManager, Context, UUID } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { type DBConnection } from '../../drizzle/db';
import { MemberCreationDTO, MemberRaw } from '../../drizzle/types';
import { TRANSLATIONS } from '../../langs/constants';
import { BaseLogger } from '../../logger';
import { MailBuilder } from '../../plugins/mailer/builder';
import { type MailerService } from '../../plugins/mailer/mailer.service';
import { type MemberInfo } from '../../types';
import {
  EMAIL_CHANGE_JWT_EXPIRATION_IN_MINUTES,
  EMAIL_CHANGE_JWT_SECRET,
} from '../../utils/config';
import { MemberAlreadySignedUp } from '../../utils/errors';
import { NEW_EMAIL_PARAM, SHORT_TOKEN_PARAM } from '../auth/plugins/passport';
import { MemberRepository } from './member.repository';

@singleton()
export class MemberService {
  // private readonly mailerService: MailerService;
  private readonly log: BaseLogger;
  private readonly memberRepository: MemberRepository;

  constructor(
    // mailerService: MailerService,
    log: BaseLogger,
    memberRepository: MemberRepository,
  ) {
    // this.mailerService = mailerService;
    this.memberRepository = memberRepository;
    this.log = log;
  }

  async get(db: DBConnection, id: string) {
    return this.memberRepository.get(db, id);
  }

  async getByEmail(db: DBConnection, email: string) {
    return await this.memberRepository.getByEmail(db, email);
  }

  async getMany(db: DBConnection, ids: string[]) {
    return this.memberRepository.getMany(db, ids);
  }

  async getManyByEmails(db: DBConnection, emails: string[]) {
    return this.memberRepository.getManyByEmails(
      db,
      emails.map((email) => email.trim().toLowerCase()),
    );
  }

  async post(
    db: DBConnection,
    body: Partial<MemberCreationDTO> & Pick<MemberCreationDTO, 'email' | 'name'>,
    lang = DEFAULT_LANG,
  ) {
    // The email is lowercased when the user registers
    // To every subsequents call, it is to the client to ensure the email is sent in lowercase
    // the servers always do a 1:1 match to retrieve the member by email.
    const email = body.email.toLowerCase();

    // check if member w/ email already exists
    const member = await this.memberRepository.getByEmail(db, email);

    if (!member) {
      const newMember = {
        ...body,
        extra: { lang },
      };

      const member = await this.memberRepository.post(db, newMember);

      return member;
    } else {
      throw new MemberAlreadySignedUp({ email });
    }
  }

  async patch(
    db: DBConnection,
    id: UUID,
    body: Partial<Pick<MemberRaw, 'extra' | 'email' | 'name' | 'enableSaveActions'>>,
  ) {
    return this.memberRepository.patch(db, id, {
      name: body.name,
      email: body.email,
      extra: body?.extra,
      enableSaveActions: body.enableSaveActions,
    });
  }

  async deleteCurrent(memberId: string, db: DBConnection) {
    await this.memberRepository.deleteOne(db, memberId);
  }

  async deleteOne(db: DBConnection, id: UUID) {
    return this.memberRepository.deleteOne(db, id);
  }

  async refreshLastAuthenticatedAt(db: DBConnection, id: UUID) {
    return await this.memberRepository.patch(db, id, {
      lastAuthenticatedAt: new Date().toISOString(),
    });
  }
  async validate(db: DBConnection, id: UUID) {
    return await this.memberRepository.patch(db, id, { isValidated: true });
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
    // this.mailerService
    // .send(mail, newEmail)
    // .catch((err) => this.log.warn(err, `mailer failed. link: ${link}`));
  }

  mailConfirmEmailChangeRequest(oldEmail: string, newEmail: string, lang: string) {
    const mail = new MailBuilder({
      subject: { text: TRANSLATIONS.CONFIRM_CHANGE_EMAIL_TITLE },
      lang: lang,
    })
      .addText(TRANSLATIONS.CONFIRM_CHANGE_EMAIL_TEXT, { newEmail })
      .build();

    // don't wait for mailer's response; log error and link if it fails.
    // this.mailerService.send(mail, oldEmail).catch((err) => this.log.warn(err, `mailer failed.`));
  }
}
