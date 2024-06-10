import * as eta from 'eta';
import { singleton } from 'tsyringe';
import { promisify } from 'util';

import pointOfView from '@fastify/view';
import { FastifyInstance } from 'fastify';

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

@singleton()
export class MailerService {
  private host: string;
  private port: number;
  private useSsl: boolean;
  private username: string;
  private password: string;
  private fromEmail: string;
  // eslint-disable-next-line @typescript-eslint/ban-types
  private promisifiedNodemailerSendMail: Function;

  constructor(options: MailerOptions, fastify: FastifyInstance) {
    this.host = options.host;
    this.port = options.port ?? 465;
    this.useSsl = options.useSsl ?? true;
    this.username = options.username;
    this.password = options.password;
    this.fromEmail = options.fromEmail;

    // TODO: should await ?
    this.register(fastify);
  }

  private async register(fastify: FastifyInstance) {
    fastify.register(pointOfView, { engine: { eta } });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    await fastify.register(require('fastify-nodemailer'), {
      host: this.host,
      auth: { user: this.username, pass: this.password },
      pool: true,
      port: this.port,
      secure: this.useSsl,
    });

    // sendMail() uses 'this' internally and 'promisify' breaks that, so it needs to be passed
    this.promisifiedNodemailerSendMail = promisify(
      fastify.nodemailer.sendMail.bind(fastify.nodemailer),
    );
  }

  public async sendEmail(
    subject: string,
    to: string,
    text: string,
    html: string,
    footer: string,
    from: string = this.fromEmail,
  ) {
    await this.promisifiedNodemailerSendMail({
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
