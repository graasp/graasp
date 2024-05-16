import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { RecaptchaAction } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { MOBILE_DEEP_LINK_PROTOCOL } from '../../../../utils/config';
import { buildRepositories } from '../../../../utils/repositories';
import { getRedirectionUrl } from '../../utils';
import { MemberPasswordService } from '../password/service';
import { authWeb, mPasswordLogin, mauth, mlogin, mregister } from './schemas';
import { MobileService } from './service';

// token based auth and endpoints for mobile
const plugin: FastifyPluginAsync = async (fastify) => {
  const { log, db, generateAuthTokensPair } = fastify;

  const mobileService = new MobileService(fastify, log);
  const memberPasswordService = new MemberPasswordService(log);

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
  }>('/register', { schema: mregister }, async (request, reply) => {
    const {
      body,
      query: { lang = DEFAULT_LANG },
    } = request;

    // validate captcha
    await fastify.validateCaptcha(request, body.captcha, RecaptchaAction.SignUpMobile);

    return db.transaction(async (manager) => {
      await mobileService.register(undefined, buildRepositories(manager), body, lang);
      await reply.status(StatusCodes.NO_CONTENT);
    });
  });

  fastify.post<{
    Body: { email: string; challenge: string; captcha: string };
    Querystring: { lang?: string };
  }>('/login', { schema: mlogin }, async (request, reply) => {
    const {
      body,
      query: { lang },
    } = request;

    // validate captcha
    await fastify.validateCaptcha(request, body.captcha, RecaptchaAction.SignInMobile);

    await mobileService.login(undefined, buildRepositories(), body, lang);
    await reply.status(StatusCodes.NO_CONTENT);
  });

  // login with password
  fastify.post<{ Body: { email: string; challenge: string; password: string; captcha: string } }>(
    '/login-password',
    { schema: mPasswordLogin },
    async (request, reply) => {
      const { body } = request;

      // validate captcha
      await fastify.validateCaptcha(
        request,
        body.captcha,
        RecaptchaAction.SignInWithPasswordMobile,
        { shouldFail: false },
      );

      const token = await memberPasswordService.login(
        undefined,
        buildRepositories(),
        body,
        body.challenge,
      );

      // redirect to the universal link domain
      const redirectionUrl = new URL(`${MOBILE_DEEP_LINK_PROTOCOL}//auth`);
      redirectionUrl.searchParams.set('t', token);
      await reply.status(StatusCodes.SEE_OTHER);

      return { resource: redirectionUrl.toString() };
    },
  );

  fastify.post<{ Body: { t: string; verifier: string } }>(
    '/auth',
    { schema: mauth },
    async ({ body: { t: token, verifier } }) => {
      return mobileService.auth(undefined, buildRepositories(), token, verifier);
    },
  );

  fastify.get('/auth/refresh', { preHandler: fastify.verifyBearerAuth }, async ({ memberId }) =>
    generateAuthTokensPair(memberId),
  );

  // from user token, set corresponding cookie
  fastify.get<{ Querystring: { token: string; url: string } }>(
    '/auth/web',
    { schema: authWeb },
    async ({ query, session }, reply) => {
      const memberId = await mobileService.getMemberIdFromAuthToken(
        undefined,
        buildRepositories(),
        query.token,
      );

      session.set('member', memberId);

      const redirectionUrl = getRedirectionUrl(
        log,
        query.url ? decodeURIComponent(query.url) : undefined,
      );
      await reply.redirect(StatusCodes.SEE_OTHER, redirectionUrl);
    },
  );
};

export default plugin;
