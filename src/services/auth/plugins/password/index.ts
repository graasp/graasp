import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { RecaptchaAction } from '@graasp/sdk';

import { PROTOCOL, PUBLIC_URL } from '../../../../utils/config';
import { UnauthorizedMember } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import { getRedirectionUrl } from '../../utils';
import { passwordLogin, updatePassword } from './schemas';
import { MemberPasswordService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { log, db } = fastify;

  const memberPasswordService = new MemberPasswordService(log);

  // login with password
  fastify.post<{
    Body: { email: string; password: string; captcha: string };
    Querystring: { url?: string };
  }>('/login-password', { schema: passwordLogin }, async (request, reply) => {
    const {
      body,
      log,
      query: { url },
    } = request;

    // validate captcha
    await fastify.validateCaptcha(request, body.captcha, RecaptchaAction.SignInWithPassword);

    const token = await memberPasswordService.login(undefined, buildRepositories(), body);
    const redirectionUrl = getRedirectionUrl(url);
    // link for graasp web
    const linkPath = '/auth';
    // todo: selectively add the url param if it is present
    // and maybe build the url using the URL constructor ?
    const resource = `${PROTOCOL}://${PUBLIC_URL}${linkPath}?t=${token}&url=${redirectionUrl}`;
    reply.status(StatusCodes.SEE_OTHER);
    return { resource };
  });

  // update member password
  fastify.patch<{ Body: { currentPassword: string; password: string } }>(
    '/members/update-password',
    { schema: updatePassword, preHandler: fastify.verifyAuthentication },
    async ({ member, body: { currentPassword, password } }) => {
      if (!member) {
        throw new UnauthorizedMember(member);
      }
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
