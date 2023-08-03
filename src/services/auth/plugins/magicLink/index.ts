import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { DEFAULT_LANG, RecaptchaAction } from '@graasp/sdk';

import { AUTH_CLIENT_HOST } from '../../../../utils/config';
import { MemberAlreadySignedUp } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import { getRedirectionUrl } from '../../utils';
import { auth, login, register } from './schemas';
import { MagicLinkService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    log,
    db,
    members: { service: memberService },
  } = fastify;

  const magicLinkService = new MagicLinkService(fastify, log);

  // cookie based auth and api endpoints
  await fastify.register(async function (fastify) {
    // register
    fastify.post<{
      Body: { name: string; email: string; captcha: string };
      Querystring: { lang?: string; url?: string };
    }>('/register', { schema: register }, async (request, reply) => {
      const {
        body,
        query: { lang = DEFAULT_LANG, url },
        log,
      } = request;

      // validate captcha
      await fastify.validateCaptcha(request, body.captcha, RecaptchaAction.SignUp);

      return db.transaction(async (manager) => {
        try {
          // we use member service to allow post hook for invitation
          const member = await memberService.post(
            undefined,
            buildRepositories(manager),
            body,
            lang,
          );

          await magicLinkService.sendRegisterMail(
            undefined,
            buildRepositories(manager),
            member,
            url,
          );
          reply.status(StatusCodes.NO_CONTENT);
        } catch (e) {
          if (!(e instanceof MemberAlreadySignedUp)) {
            throw e;
          }
          // send login email
          await magicLinkService.login(undefined, buildRepositories(manager), body, lang);
          reply.status(StatusCodes.NO_CONTENT);
        }
      });
    });

    // login
    fastify.post<{
      Body: { email: string; captcha: string };
      Querystring: { lang?: string; url?: string };
    }>('/login', { schema: login }, async (request, reply) => {
      const {
        body,
        query: { lang, url },
      } = request;

      // validate captcha
      await fastify.validateCaptcha(request, body.captcha, RecaptchaAction.SignIn);

      await magicLinkService.login(undefined, buildRepositories(), body, lang, url);
      reply.status(StatusCodes.NO_CONTENT);
    });

    // authenticate
    fastify.get<{ Querystring: { t: string; url?: string } }>(
      '/auth',
      { schema: auth },
      async (request, reply) => {
        const {
          query: { t: token, url },
          session,
        } = request;

        try {
          const { sub: memberId } = await magicLinkService.auth(
            undefined,
            buildRepositories(),
            token,
          );

          // add member id to session
          session.set('member', memberId);
          const redirectionUrl = getRedirectionUrl(url);

          if (redirectionUrl) {
            reply.redirect(StatusCodes.SEE_OTHER, redirectionUrl);
          } else {
            reply.status(StatusCodes.NO_CONTENT);
          }
        } catch (error) {
          session.delete();
          if (AUTH_CLIENT_HOST) {
            // todo: provide more detailed message
            reply.redirect(
              StatusCodes.SEE_OTHER,
              new URL(`${AUTH_CLIENT_HOST}?error=true`).toString(),
            );
          } else {
            log.error(error);
            throw error;
          }
        }
      },
    );

    // logout
    fastify.get('/logout', async ({ session }, reply) => {
      // remove session
      session.delete();
      reply.status(204);
    });
  });
};

export default plugin;
