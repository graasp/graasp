import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { BUGS_RECIVER_EMAIL } from '../../utils/config';
import { bugSchema } from './fluent-schema';
import { generateEmail } from './utils';

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { name: string; email: string; details: string } }>(
    '/',
    {
      schema: bugSchema,
      preHandler: fastify.verifyAuthentication,
    },
    async (request, reply) => {
      const { member, body: data } = request;
      const { log, mailer } = fastify;

      const subject = `Graasp Builder | User Feedback`;
      const html = generateEmail(data);

      if (BUGS_RECIVER_EMAIL) {
        return mailer
          .sendEmail(subject, BUGS_RECIVER_EMAIL, '', html)
          .then(() => ({ message: 'feedback received successfully' }))
          .catch((err) => log.warn(err, `mailer failed.`));
      } else {
        reply.status(StatusCodes.BAD_REQUEST);
      }
    },
  );
};

export default plugin;
