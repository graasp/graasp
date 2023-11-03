import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { RecaptchaAction } from '@graasp/sdk';

import { PUBLIC_URL } from '../../../../utils/config';
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
    Body: { email: string; password: string; captcha: string; url?: string };
  }>('/login-password', { schema: passwordLogin }, async (request, reply) => {
    const { body, log } = request;
    const { url } = body;

    // validate captcha
    await fastify.validateCaptcha(request, body.captcha, RecaptchaAction.SignInWithPassword);

    const token = await memberPasswordService.login(undefined, buildRepositories(), body);
    const redirectionUrl = getRedirectionUrl(log, url);

    const target = new URL('/auth', PUBLIC_URL);
    target.searchParams.set('t', token);
    target.searchParams.set('url', encodeURIComponent(redirectionUrl));
    const resource = target.toString();

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
