import { Transporter, createTransport } from 'nodemailer';

import { DEFAULT_LANG } from '@graasp/translations';

import { GRAASP_LANDING_PAGE_ORIGIN } from '../../utils/constants';
import i18next from './i18n';
import { MAIL } from './langs/constants';
import { applyLayout } from './layout';

export interface MailerOptions {
  host: string;
  port?: number;
  useSsl?: boolean;
  username: string;
  password: string;
  fromEmail: string;
}

type CssStyles = { [key: string]: string };

export class MailerService {
  private readonly fromEmail: string;
  private readonly transporter: Transporter;

  constructor({ host, port, useSsl, username, password, fromEmail }: MailerOptions) {
    this.fromEmail = fromEmail;
    this.transporter = createTransport({
      host,
      port: port ?? 465,
      secure: useSsl ?? true,
      auth: {
        user: username,
        pass: password,
      },
    });
  }

  public translate(lang: string = DEFAULT_LANG) {
    i18next.changeLanguage(lang);
    return i18next.t;
  }

  public async sendEmailChangeRequestConfirmation(
    oldEmail: string,
    newEmail: string,
    userLang: string,
  ) {
    const lang = userLang ?? DEFAULT_LANG;
    const t = this.translate(lang);

    const subject = t(MAIL.CONFIRM_CHANGE_EMAIL_TITLE);
    const text = t(MAIL.CONFIRM_CHANGE_EMAIL_TEXT, { newEmail });

    const footer = this.buildFooter(lang);

    return this.sendEmail(subject, oldEmail, text, text, footer);
  }

  public async composeAndSendEmail(
    email: string,
    userLang: string,
    subject: string,
    buttonText: string,
    text: string,
    translationVariables: { [key: string]: string },
    callToActionLink: string,
    includeUserAgreement: boolean = false,
    signUpNotRequested: boolean = false,
  ) {
    const lang = userLang ?? DEFAULT_LANG;
    const t = this.translate(lang);

    const htmlText = t(text, translationVariables);

    let specialText = '';
    if (includeUserAgreement) {
      specialText += this.buildText(
        t(MAIL.USER_AGREEMENTS_MAIL_TEXT, {
          signUpButtonText: t(buttonText, translationVariables),
          graaspLandingPageOrigin: GRAASP_LANDING_PAGE_ORIGIN,
        }),
        // Add margin top of -15px to remove 15px margin bottom of the button.
        { 'text-align': 'center', 'font-size': '10px', 'margin-top': '-15px' },
      );
    }
    if (signUpNotRequested) {
      specialText += this.buildText(t(MAIL.SIGN_UP_NOT_REQUESTED));
    }

    const html = `
      ${this.buildText(htmlText)}
      ${this.buildButton(callToActionLink, t(buttonText, translationVariables))}
      ${specialText}
    `;

    const emailSubject = t(subject, {
      ...translationVariables,
      interpolation: { escapeValue: false },
    });

    const footer = this.buildFooter(lang);

    return this.sendEmail(emailSubject, email, callToActionLink, html, footer);
  }

  public async sendEmail(
    subject: string,
    to: string,
    text: string,
    html: string,
    footer: string,
    from: string = this.fromEmail,
  ) {
    await this.transporter.sendMail({
      from,
      to,
      subject,
      text,
      html: applyLayout(html, footer),
    });
  }

  private buildFooter(lang: string = DEFAULT_LANG): string {
    const t = this.translate(lang);
    return `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
        <tr>
          <td class="content-block">
            ${t('FOOTER')}.
            <br />
            <span class="apple-link">Graasp Association, Valais, Switzerland</span>
          </td>
        </tr>
        <tr>
          <td class="content-block powered-by">
            ${t('POWERED_BY')}
          </td>
        </tr>
      </table>
    `;
  }

  private buildButton(link: string, text: string): string {
    return `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="btn btn-primary">
        <tbody>
          <tr>
            <td align="center">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tbody>
                  <tr>
                    <td><a href="${link}" target="_blank">${text}</a></td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    `;
  }

  private buildStyles(styles?: CssStyles): string {
    if (styles) {
      const strStyles = Object.keys(styles).map((key: string) => `${key}: ${styles[key]}`);
      return `style="${strStyles.join('; ')}"`;
    }
    return '';
  }

  private buildText(text: string, styles?: CssStyles): string {
    return `<p ${this.buildStyles(styles)}>${text}</p>`;
  }
}
