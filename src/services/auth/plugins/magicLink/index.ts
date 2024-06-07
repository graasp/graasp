import { StatusCodes } from 'http-status-codes';

import fastifyPassport from '@fastify/passport';
import { FastifyPluginAsync, FastifyReply, FastifyRequest, PassportUser } from 'fastify';

import { RecaptchaAction } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { AUTH_CLIENT_HOST } from '../../../../utils/config';
import { MemberAlreadySignedUp } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import { getRedirectionUrl } from '../../utils';
import captchaPreHandler from '../captcha';
import { PassportStrategy } from '../passport/strategies';
import { auth, login, register } from './schemas';
import { MagicLinkService } from './service';

const ERROR_SEARCH_PARAM = 'error';
const ERROR_SEARCH_PARAM_HAS_ERROR = 'true';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    log,
    db,
    members: { service: memberService },
  } = fastify;

  const magicLinkService = new MagicLinkService(fastify, log);
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
  }>(
    '/register',
    { schema: register, preHandler: captchaPreHandler(RecaptchaAction.SignUp) },
    async (request, reply) => {
      const {
        body,
        query: { lang = DEFAULT_LANG },
      } = request;
      const { url } = body;

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
    },
  );

  // login
  fastify.post<{
    Body: { email: string; captcha: string; url?: string };
    Querystring: { lang?: string };
  }>(
    '/login',
    {
      schema: login,
      preHandler: captchaPreHandler(RecaptchaAction.SignIn),
    },
    async (request, reply) => {
      const {
        body,
        query: { lang },
      } = request;
      const { url } = body;

      await magicLinkService.login(undefined, buildRepositories(), body, lang, url);
      reply.status(StatusCodes.NO_CONTENT);
    },
  );

  // authenticate
  fastify.get<{ Querystring: { t: string; url?: string } }>(
    '/auth',
    {
      schema: auth,
      preHandler: fastifyPassport.authenticate(
        PassportStrategy.WebMagicLink,
        async (
          request: FastifyRequest,
          reply: FastifyReply,
          err: null | Error,
          user?: PassportUser,
        ) => {
          // This function is called after the strategy has been executed.
          // It is necessary, so we match the behavior of the original implementation.
          if (!user || err) {
            // Authentication failed
            const target = new URL('/', AUTH_CLIENT_HOST);
            target.searchParams.set(ERROR_SEARCH_PARAM, ERROR_SEARCH_PARAM_HAS_ERROR);
            reply.redirect(StatusCodes.SEE_OTHER, target.toString());
          } else {
            request.logIn(user, { session: true });
          }
        },
      ),
    },
    async (request, reply) => {
      const {
        query: { url },
        log,
      } = request;
      const redirectionUrl = getRedirectionUrl(log, url ? decodeURIComponent(url) : undefined);
      reply.redirect(StatusCodes.SEE_OTHER, redirectionUrl);
    },
  );

  // logout
  fastify.get('/logout', async (request, reply) => {
    request.logOut();
    reply.status(StatusCodes.NO_CONTENT);
  });
};

export default plugin;
