import * as eta from 'eta';
import { promisify } from 'util';

import pointOfView from '@fastify/view';
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { DEFAULT_LANG } from '@graasp/sdk';
import buildI18n, { namespaces } from '@graasp/translations';

import { applyLayout } from './layout';

export interface MailerOptions {
  host: string;
  username: string;
  password: string;
  fromEmail: string;
}

const plugin: FastifyPluginAsync<MailerOptions> = async (fastify, options) => {
  const { host, username: user, password: pass, fromEmail } = options;

  fastify.register(pointOfView, { engine: { eta } });

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  await fastify.register(require('fastify-nodemailer'), {
    host,
    auth: { user, pass },
    pool: true,
    port: 465,
    secure: true,
  });

  const i18n = buildI18n(namespaces.mail, false);

  const promisifiedNodemailerSendMail =
    // sendMail() uses 'this' internally and 'promisify' breaks that, so it needs to be passed
    promisify(fastify.nodemailer.sendMail.bind(fastify.nodemailer));

  async function sendEmail(
    subject: string,
    to: string,
    text: string,
    html: string,
    from: string = fromEmail,
  ) {
    // TODO: does it make sense to return the return value of nodemailer?
    await promisifiedNodemailerSendMail({ from, to, subject, text, html: applyLayout(html) });
  }

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

  const buildText = (text) => `<p>${text}</p>`;

  const translate = (lang: string = DEFAULT_LANG) => {
    i18n.changeLanguage(lang);
    return i18n.t;
  };

  // const modulePath = module.path;

  // // Login
  // async function sendLoginEmail(
  //   member: { email: string; name: string },
  //   link: string,
  //   reRegistrationAttempt = false,
  //   lang = DEFAULT_LANG,
  // ) {
  //   fastify.i18n.locale(lang);
  //   const translated = fastify.i18n.locales[lang] ?? fastify.i18n.locales[DEFAULT_LANG];
  //   const html = await fastify.view(`${modulePath}/templates/login.eta`, {
  //     member,
  //     link,
  //     reRegistrationAttempt,
  //     translated,
  //   });
  //   const title = translated['signInMailTitle'];
  //   await sendMail(fromEmail, member.email, title, link, html);
  // }

  // // Register
  // async function sendRegisterEmail(
  //   member: { email: string; name: string },
  //   link: string,
  //   lang = DEFAULT_LANG,
  // ) {
  //   fastify.i18n.locale(lang);
  //   const translated = fastify.i18n.locales[lang] ?? fastify.i18n.locales[DEFAULT_LANG];
  //   const html = await fastify.view(`${modulePath}/templates/register.eta`, {
  //     member,
  //     link,
  //     translated,
  //   });
  //   const title = translated['registrationMailTitle'];
  //   await sendMail(fromEmail, member.email, title, link, html);
  // }

  // // Invitation
  // async function sendInvitationEmail(
  //   email: string,
  //   link: string,
  //   itemName: string,
  //   creatorName: string,
  //   lang = DEFAULT_LANG,
  // ) {
  //   fastify.i18n.locale(lang);
  //   const translated = fastify.i18n.locales[lang] ?? fastify.i18n.locales[DEFAULT_LANG];
  //   // this line necessary for .t() to correctly use the changed locale
  //   fastify.i18n.replace(translated);
  //   const text = fastify.i18n.t('invitationText', {
  //     itemName,
  //     creatorName,
  //   });
  //   const html = await fastify.view(`${modulePath}/templates/invitation.eta`, {
  //     link,
  //     translated,
  //     text,
  //   });
  //   const title = translated['invitationMailTitle'];
  //   await sendMail(fromEmail, email, title, link, html);
  // }

  // // Download link for actions
  // async function sendExportActionsEmail(
  //   member: { email: string; name: string },
  //   link: string,
  //   itemName: string,
  //   lang: string = DEFAULT_LANG,
  //   expirationDays: number = DEFAULT_EXPORT_ACTIONS_VALIDITY_IN_DAYS,
  // ) {
  //   fastify.i18n.locale(lang);
  //   const translated = fastify.i18n.locales[lang] ?? fastify.i18n.locales[DEFAULT_LANG];
  //   // this line necessary for .t() to correctly use the changed locale
  //   fastify.i18n.replace(translated);
  //   const information = fastify.i18n.t('exportActionsInformation', {
  //     itemName,
  //     days: expirationDays,
  //   });

  //   const html = await fastify.view(`${modulePath}/templates/exportActions.eta`, {
  //     member,
  //     link,
  //     translated,
  //     information,
  //   });
  //   const title = fastify.i18n.t('exportActionsMailTitle', { itemName });
  //   await sendMail(fromEmail, member.email, title, link, html);
  // }

  // // Notification for publish an item
  // async function sendPublishNotificationEmail(
  //   member: { email: string; name: string },
  //   link: string,
  //   itemName: string,
  //   lang = DEFAULT_LANG,
  // ) {
  //   fastify.i18n.locale(lang);
  //   const translated = fastify.i18n.locales[lang] ?? fastify.i18n.locales[DEFAULT_LANG];
  //   // this line necessary for .t() to correctly use the changed locale
  //   fastify.i18n.replace(translated);
  //   const text = fastify.i18n.t('publishNotification', {
  //     itemName,
  //   });
  //   const html = await fastify.view(`${modulePath}/templates/publishNotification.eta`, {
  //     member,
  //     text,
  //     translated,
  //     link,
  //   });
  //   const title = fastify.i18n.t('publishNotificationTitle', { itemName });
  //   await sendMail(fromEmail, member.email, title, link, html);
  // }

  // // Notification for chat mention
  // async function sendChatMentionNotificationEmail(
  //   member: { email: string; name: string },
  //   link: string,
  //   itemName: string,
  //   creatorName: string,
  //   lang = DEFAULT_LANG,
  // ) {
  //   fastify.i18n.locale(lang);
  //   const translated = fastify.i18n.locales[lang] ?? fastify.i18n.locales[DEFAULT_LANG];
  //   // this line necessary for .t() to correctly use the changed locale
  //   fastify.i18n.replace(translated);
  //   const text = fastify.i18n.t('chatMentionNotification', {
  //     creatorName,
  //     itemName,
  //   });
  //   const html = await fastify.view(`${modulePath}/templates/chatMentionNotification.eta`, {
  //     member,
  //     text,
  //     translated,
  //     link,
  //   });
  //   const title = fastify.i18n.t('chatMentionNotificationTitle', {
  //     creatorName,
  //     itemName,
  //   });
  //   await sendMail(fromEmail, member.email, title, link, html);
  // }

  fastify.decorate('mailer', {
    // sendLoginEmail,
    // sendRegisterEmail,
    // sendExportActionsEmail,
    // sendInvitationEmail,
    // sendPublishNotificationEmail,
    // sendChatMentionNotificationEmail,
    buildButton,
    buildText,
    sendEmail,
    translate,
  });
};

export default fp(plugin, {
  fastify: '4.x',
  name: 'graasp-mailer',
});
