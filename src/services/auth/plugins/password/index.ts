import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { EMAIL_LINKS_HOST, PROTOCOL } from '../../../../util/config';
import { buildRepositories } from '../../../../util/repositories';
import { passwordLogin, updatePassword } from '../../schemas';
import { MemberPasswordService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { log, db } = fastify;

  const memberPasswordService = new MemberPasswordService(log);

  // login with password
  fastify.post<{ Body: { email: string; password: string } }>(
    '/login-password',
    { schema: passwordLogin },
    async ({ body, log }, reply) => {
      // TODO: actor
      const token = await memberPasswordService.login(null, buildRepositories(), body);

      // link for graasp web
      const linkPath = '/auth';
      const resource = `${PROTOCOL}://${EMAIL_LINKS_HOST}${linkPath}?t=${token}`;
      reply.status(StatusCodes.SEE_OTHER);
      return { resource };
    },
  );

  // update member password
  fastify.patch<{ Body: { currentPassword: string; password: string } }>(
    '/members/update-password',
    { schema: updatePassword, preHandler: fastify.verifyAuthentication },
    async ({ member, body: { currentPassword, password } }) => {
      return db.transaction(async (manager) => {
        return memberPasswordService.patch(
          member,
          buildRepositories(manager),
          password,
          currentPassword,
        );
      });
    },
  );
};

export default plugin;
