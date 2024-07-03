import { sign as jwtSign } from 'jsonwebtoken';
import { singleton } from 'tsyringe';

import { UUID } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { BaseLogger } from '../../logger';
import { MAIL } from '../../plugins/mailer/langs/constants';
import { MailerService } from '../../plugins/mailer/service';
import {
  ACCOUNT_HOST,
  EMAIL_CHANGE_JWT_EXPIRATION_IN_MINUTES,
  EMAIL_CHANGE_JWT_SECRET,
} from '../../utils/config';
import { CannotModifyOtherMembers, MemberAlreadySignedUp } from '../../utils/errors';
import HookManager from '../../utils/hook';
import { Repositories } from '../../utils/repositories';
import { SHORT_TOKEN_PARAM } from '../auth/plugins/passport';
import { Actor, Member } from './entities/member';

@singleton()
export class MemberService {
  hooks = new HookManager();
  private readonly mailerService: MailerService;
  private readonly log: BaseLogger;

  constructor(mailerService: MailerService, log: BaseLogger) {
    this.mailerService = mailerService;
    this.log = log;
  }

  async get(actor: Actor, { memberRepository }: Repositories, id: string) {
    return memberRepository.get(id);
  }

  async getByEmail({ memberRepository }: Repositories, email: string) {
    return await memberRepository.getByEmail(email);
  }

  async getMany(actor: Actor, { memberRepository }: Repositories, ids: string[]) {
    return memberRepository.getMany(ids);
  }

  async getManyByEmail(actor: Actor, { memberRepository }: Repositories, emails: string[]) {
    return memberRepository.getManyByEmail(emails.map((email) => email.trim().toLowerCase()));
  }

  async post(
    actor: Actor,
    repositories: Repositories,
    body: Pick<Member, 'email'>,
    lang = DEFAULT_LANG,
  ) {
    // actor may not exist on register

    const { memberRepository } = repositories;

    // The email is lowercased when the user registers
    // To every subsequents call, it is to the client to ensure the email is sent in lowercase
    // the servers always do a 1:1 match to retrieve the member by email.
    const email = body.email.toLowerCase();

    // check if member w/ email already exists
    const member = await memberRepository.getByEmail(email);

    if (!member) {
      const newMember = {
        ...body,
        extra: { lang },
      };

      const member = await memberRepository.post(newMember);

      // post hook
      await this.hooks.runPostHooks('create', actor, repositories, { member });

      return member;
    } else {
      throw new MemberAlreadySignedUp({ email });
    }

    // TODO: refactor
  }

  async patch(
    { memberRepository }: Repositories,
    id: UUID,
    body: Partial<Pick<Member, 'extra' | 'email' | 'name' | 'enableSaveActions'>>,
  ) {
    return memberRepository.patch(id, {
      name: body.name,
      email: body.email,
      extra: body?.extra,
      enableSaveActions: body.enableSaveActions,
    });
  }

  async deleteCurrent(member: Member, { memberRepository }: Repositories) {
    return memberRepository.deleteOne(member.id);
  }

  async deleteOne(actor: Actor, { memberRepository }: Repositories, id: UUID) {
    if (!actor || actor.id !== id) {
      throw new CannotModifyOtherMembers(id);
    }

    return memberRepository.deleteOne(id);
  }

  createEmailChangeRequest(member: Member, newEmail: string) {
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
    const translated = this.mailerService.translate(lang);
    const subject = translated(MAIL.CHANGE_EMAIL_TITLE);
    const destination = new URL('/email/change', ACCOUNT_HOST.url);
    destination.searchParams.set(SHORT_TOKEN_PARAM, token);
    const link = destination.toString();

    const html = `
      ${this.mailerService.buildText(translated(MAIL.CHANGE_EMAIL_TEXT))}
      ${this.mailerService.buildButton(link, translated(MAIL.CHANGE_EMAIL_BUTTON_TEXT))}
      ${this.mailerService.buildText(translated(MAIL.CHANGE_EMAIL_NOT_REQUESTED))}`;

    const footer = this.mailerService.buildFooter(lang);

    // don't wait for mailer's response; log error and link if it fails.
    this.mailerService
      .sendEmail(subject, newEmail, link, html, footer)
      .catch((err) => this.log.warn(err, `mailer failed. link: ${link}`));
  }

  mailConfirmEmailChangeRequest(oldEmail: string, newEmail: string, lang: string) {
    const translated = this.mailerService.translate(lang);
    const subject = translated(MAIL.CONFIRM_CHANGE_EMAIL_TITLE);
    const text = translated(MAIL.CONFIRM_CHANGE_EMAIL_TEXT, { newEmail });

    const footer = this.mailerService.buildFooter(lang);

    // don't wait for mailer's response; log error and link if it fails.
    this.mailerService
      .sendEmail(subject, oldEmail, text, text, footer)
      .catch((err) => this.log.warn(err, `mailer failed.`));
  }
}
