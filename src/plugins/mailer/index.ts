import * as eta from 'eta';
import type { i18n } from 'i18next';
import { promisify } from 'util';

import pointOfView from '@fastify/view';
import { FastifyPluginAsync } from 'fastify';
import fastifyMailer from 'fastify-nodemailer';
import fp from 'fastify-plugin';

import { DEFAULT_LANG } from '@graasp/translations';

import i18next from './i18n.js';
import { applyLayout } from './layout.js';

export type MailerOptions = {
  host: string;
  port?: number;
  useSsl?: boolean;
  username: string;
  password: string;
  fromEmail: string;
};

type CssStyles = Record<string, string>;

export type MailerDecoration = {
  buildButton: (link: string, text: string) => string;
  buildText: (str: string, cssStyles?: CssStyles) => string;
  sendEmail: (
    subject: string,
    to: string,
    text: string,
    html: string,
    footer: string,
    from?: string,
  ) => Promise<void>;
  translate: (lang: string) => i18n['t'];
  buildFooter: (lang?: string) => string;
};

const plugin: FastifyPluginAsync<MailerOptions> = async (fastify, options) => {
  const { host, port = 465, useSsl = true, username: user, password: pass, fromEmail } = options;

  fastify.register(pointOfView, { engine: { eta } });

  await fastify.register(fastifyMailer, {
    host,
    auth: { user, pass },
    pool: true,
    port,
    secure: useSsl,
  });

  const promisifiedNodemailerSendMail =
    // sendMail() uses 'this' internally and 'promisify' breaks that, so it needs to be passed
    promisify(fastify.nodemailer.sendMail.bind(fastify.nodemailer));

  const sendEmail = async (
    subject: string,
    to: string,
    text: string,
    html: string,
    footer: string,
    from: string = fromEmail,
  ) => {
    await promisifiedNodemailerSendMail({
      from,
      to,
      subject,
      text,
      html: applyLayout(html, footer),
    });
  };

  const buildFooter = (lang: string = DEFAULT_LANG): string => {
    const t = translate(lang);
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
  };

  const buildButton = (link: string, text: string): string => {
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
  };

  const buildStyles = (styles?: CssStyles) => {
    if (styles) {
      const strStyles = Object.keys(styles).map((key: string) => `${key}: ${styles[key]}`);
      return `style="${strStyles.join('; ')}"`;
    }
    return '';
  };

  const buildText = (text: string, styles?: CssStyles) => {
    return `<p ${buildStyles(styles)}>${text}</p>`;
  };

  const translate = (lang: string = DEFAULT_LANG) => {
    i18next.changeLanguage(lang);
    return i18next.t;
  };

  const decorations: MailerDecoration = {
    buildButton,
    buildText,
    sendEmail,
    translate,
    buildFooter,
  };
  fastify.decorate('mailer', decorations);
};

export default fp(plugin, {
  fastify: '4.x',
  name: 'graasp-mailer',
});
