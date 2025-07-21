import { type Transporter, createTransport } from 'nodemailer';
import { singleton } from 'tsyringe';

import { applyLayout } from './layout';

export interface Mail {
  subject: string;
  text: string;
  html: string;
  footer: string;
}

export interface MailerOptions {
  connection: string;
  useSSL: boolean;
  fromEmail: string;
}

@singleton()
export class MailerService {
  private readonly fromEmail: string;
  private readonly transporter: Transporter;

  constructor({ connection, useSSL, fromEmail }: MailerOptions) {
    this.fromEmail = fromEmail;
    this.transporter = createTransport(connection, { secure: useSSL });
  }

  /**
   * Send an e-mail from a pre-processed object
   * @param mail Mail object
   * @param to Destination email
   * @param from Emitter email
   */
  public async send(mail: Mail, to: string, from: string = this.fromEmail) {
    await this.sendRaw(mail.subject, to, mail.text, mail.html, mail.footer, from);
  }

  /**
   * Send an e-mail bypassing the mail builder and translations
   */
  public async sendRaw(
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
}
