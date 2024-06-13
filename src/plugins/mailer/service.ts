import { Transporter, createTransport } from 'nodemailer';

import { DEFAULT_LANG } from '@graasp/translations';

import i18next from './i18n';
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

  public buildFooter(lang: string = DEFAULT_LANG): string {
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

  public buildButton(link: string, text: string): string {
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

  public buildText(text: string, styles?: CssStyles): string {
    return `<p ${this.buildStyles(styles)}>${text}</p>`;
  }

  public translate(lang: string = DEFAULT_LANG) {
    i18next.changeLanguage(lang);
    return i18next.t;
  }
}
