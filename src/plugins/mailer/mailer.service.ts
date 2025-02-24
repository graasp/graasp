import { Transporter, createTransport } from 'nodemailer';

import { applyLayout } from './layout';

export interface Mail {
  subject: string;
  text: string;
  html: string;
  footer: string;
}

export interface MailerOptions {
  host: string;
  port?: number;
  useSsl?: boolean;
  username: string;
  password: string;
  fromEmail: string;
}

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
