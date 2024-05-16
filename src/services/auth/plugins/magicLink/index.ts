import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { RecaptchaAction } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

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
      Body: {
        name: string;
        email: string;
        captcha: string;
        url?: string;
        enableSaveActions?: boolean;
      };
      Querystring: { lang?: string };
    }>('/register', { schema: register }, async (request, reply) => {
      const {
        body,
        query: { lang = DEFAULT_LANG },
      } = request;
      const { url } = body;

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
          await reply.status(StatusCodes.NO_CONTENT);
        } catch (e) {
          if (!(e instanceof MemberAlreadySignedUp)) {
            throw e;
          }
          // send login email
          await magicLinkService.login(undefined, buildRepositories(manager), body, lang);
          await reply.status(StatusCodes.NO_CONTENT);
        }
      });
    });

    // login
    fastify.post<{
      Body: { email: string; captcha: string; url?: string };
      Querystring: { lang?: string };
    }>('/login', { schema: login }, async (request, reply) => {
      const {
        body,
        query: { lang },
      } = request;
      const { url } = body;

      // validate captcha
      await fastify.validateCaptcha(request, body.captcha, RecaptchaAction.SignIn);

      await magicLinkService.login(undefined, buildRepositories(), body, lang, url);
      await reply.status(StatusCodes.NO_CONTENT);
    });

    // authenticate
    fastify.get<{ Querystring: { t: string; url?: string } }>(
      '/auth',
      { schema: auth },
      async (request, reply) => {
        const {
          query: { t: token, url },
          session,
          log,
        } = request;

        try {
          const { sub: memberId } = await magicLinkService.auth(
            undefined,
            buildRepositories(),
            token,
          );

          // add member id to session
          session.set('member', memberId);

          const redirectionUrl = getRedirectionUrl(log, url ? decodeURIComponent(url) : undefined);
          await reply.redirect(StatusCodes.SEE_OTHER, redirectionUrl);
        } catch (error) {
          session.delete();
          const target = new URL('/', AUTH_CLIENT_HOST);
          target.searchParams.set('error', 'true');
          await reply.redirect(StatusCodes.SEE_OTHER, target.toString());
        }
      },
    );

    // logout
    fastify.get('/logout', async ({ session }, reply) => {
      // remove session
      session.delete();
      await reply.status(StatusCodes.NO_CONTENT);
    });
  });
};

export default plugin;
