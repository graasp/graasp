import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { USER_FEEDBACK_RECEIVER_EMAIL } from '../../utils/config';
import { userFeedbackSchema } from './fluent-schema';
import { USER_FEEDBACK_MAIL } from './utils';

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { name: string; email: string; details: string } }>(
    '/',
    {
      schema: userFeedbackSchema,
      preHandler: fastify.verifyAuthentication,
    },
    async (request, reply) => {
      const { member, body: data, hostname } = request;
      const { log, mailer } = fastify;
      console.log(hostname);
      const subject = `User Feedback`;
      const { name, email, details } = data;
      const html = `
      ${mailer.buildText(USER_FEEDBACK_MAIL.GREETING)}
      ${mailer.buildText(USER_FEEDBACK_MAIL.DESCRIPTION)}
      ${mailer.buildBoldText(USER_FEEDBACK_MAIL.TITLE)}
      ${mailer.buildUnorderList([
        { title: USER_FEEDBACK_MAIL.REPORTER_NAME, value: name },
        { title: USER_FEEDBACK_MAIL.REPORTER_EMAIL, value: email },
        { title: USER_FEEDBACK_MAIL.HOSTNAME, value: hostname },
        { title: USER_FEEDBACK_MAIL.DETAILS, value: details },
      ])}
      ${mailer.buildText(USER_FEEDBACK_MAIL.CONCLUSION)}`;

      if (USER_FEEDBACK_RECEIVER_EMAIL) {
        return mailer
          .sendEmail(subject, USER_FEEDBACK_RECEIVER_EMAIL, '', html)
          .then(() => ({ message: 'feedback received successfully' }))
          .catch((err) => log.warn(err, `mailer failed.`));
      } else {
        reply.status(StatusCodes.BAD_REQUEST);
      }
    },
  );
};

export default plugin;
