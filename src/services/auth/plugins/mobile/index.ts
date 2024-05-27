import { StatusCodes } from 'http-status-codes';

import fastifyPassport from '@fastify/passport';
import { FastifyPluginAsync } from 'fastify';

import { RecaptchaAction } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import {
  LOGIN_TOKEN_EXPIRATION_IN_MINUTES,
  MOBILE_DEEP_LINK_PROTOCOL,
} from '../../../../utils/config';
import { buildRepositories } from '../../../../utils/repositories';
import { generateAuthTokensPair, getRedirectionUrl } from '../../utils';
import captchaPreHandler from '../captcha';
import {
  authenticateJWTChallengeVerifier,
  authenticateMobileMagicLink,
  authenticatePassword,
  authenticateRefreshToken,
} from '../passport';
import { authWeb, mPasswordLogin, mauth, mlogin, mregister } from './schemas';

// token based auth and endpoints for mobile
const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    log,
    db,
    memberPassword: { service: memberPasswordService },
    mobile: { service: mobileService },
  } = fastify;

  await fastify.register(fastifyPassport.initialize());
  await fastify.register(fastifyPassport.secureSession());

  // no need to add CORS support here - only used by mobile app

  /**
   * This is done for performance reasons:
   * 1. First decorateRequest with the empty type of the value to be set (null for an object)
   *    BUT NEVER SET THE ACTUAL OBJECT IN decorateRequest FOR SECURITY (reference is shared)
   * 2. Then later use a hook such as preHandler or onRequest to store the actual value
   *    (it will be properly encapsulated)
   * @example
   *  fastify.decorateRequest('user', null) // <-- must use null here if user will be an object
   *  // later in the code
   *  fastify.addHook('preHandler', (request) => {
   *     request.user = { name: 'John Doe' } // <-- must set the actual object here
   *  })
   * @see
   *  https://www.fastify.io/docs/latest/Reference/Decorators/#decoraterequestname-value-dependencies
   *  https://www.fastify.io/docs/latest/Reference/Decorators/
   */
  fastify.decorateRequest('memberId', null);

  fastify.post<{
    Body: {
      name: string;
      email: string;
      challenge: string;
      captcha: string;
      enableSaveActions?: boolean;
    };
    Querystring: { lang?: string };
  }>(
    '/register',
    {
      schema: mregister,
      preHandler: captchaPreHandler(RecaptchaAction.SignUpMobile),
    },
    async (request, reply) => {
      const {
        body,
        query: { lang = DEFAULT_LANG },
      } = request;

      return db.transaction(async (manager) => {
        await mobileService.register(undefined, buildRepositories(manager), body, lang);
        reply.status(StatusCodes.NO_CONTENT);
      });
    },
  );

  fastify.post<{
    Body: { email: string; challenge: string; captcha: string };
    Querystring: { lang?: string };
  }>(
    '/login',
    {
      schema: mlogin,
      preHandler: captchaPreHandler(RecaptchaAction.SignInMobile),
    },
    async (request, reply) => {
      const {
        body,
        query: { lang },
      } = request;

      await mobileService.login(undefined, buildRepositories(), body, lang);
      reply.status(StatusCodes.NO_CONTENT);
    },
  );

  // login with password
  fastify.post<{ Body: { email: string; challenge: string; password: string; captcha: string } }>(
    '/login-password',
    {
      schema: mPasswordLogin,

      preHandler: [
        captchaPreHandler(RecaptchaAction.SignInWithPasswordMobile, {
          shouldFail: false,
        }),
        authenticatePassword,
      ],
    },
    async (request, reply) => {
      const {
        body: { challenge },
        user,
      } = request;

      const token = await memberPasswordService.generateToken(
        { sub: user!.member!.id, challenge: challenge },
        `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
      );

      // redirect to the universal link domain
      const redirectionUrl = new URL(`${MOBILE_DEEP_LINK_PROTOCOL}//auth`);
      redirectionUrl.searchParams.set('t', token);
      reply.status(StatusCodes.SEE_OTHER);

      return { resource: redirectionUrl.toString() };
    },
  );

  fastify.post<{ Body: { t: string; verifier: string } }>(
    '/auth',
    {
      schema: mauth,
      preHandler: authenticateJWTChallengeVerifier,
    },
    async ({ user }) => {
      return generateAuthTokensPair(user!.member!.id);
    },
  );

  fastify.get(
    '/auth/refresh',
    {
      preHandler: authenticateRefreshToken,
    },
    async ({ user }) => {
      return generateAuthTokensPair(user!.member!.id);
    },
  );

  // from user token, set corresponding cookie
  fastify.get<{ Querystring: { token: string; url: string } }>(
    '/auth/web',
    {
      schema: authWeb,
      preHandler: authenticateMobileMagicLink,
    },
    async ({ query }, reply) => {
      const redirectionUrl = getRedirectionUrl(
        log,
        query.url ? decodeURIComponent(query.url) : undefined,
      );
      reply.redirect(StatusCodes.SEE_OTHER, redirectionUrl);
    },
  );
};

export default plugin;
