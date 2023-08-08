import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { DEFAULT_LANG, RecaptchaAction } from '@graasp/sdk';

import { AUTH_CLIENT_HOST, PUBLIC_URL } from '../../../../utils/config';
import { buildRepositories } from '../../../../utils/repositories';
import { MemberPasswordService } from '../password/service';
import { mPasswordLogin, mauth, mdeepLink, mlogin, mregister } from './schemas';
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
    Body: { name: string; email: string; challenge: string; captcha: string };
    Querystring: { lang?: string };
  }>('/register', { schema: mregister }, async (request, reply) => {
    const {
      body,
      query: { lang = DEFAULT_LANG },
      log,
    } = request;

    // validate captcha
    await fastify.validateCaptcha(request, body.captcha, RecaptchaAction.SignUpMobile);

    return db.transaction(async (manager) => {
      await mobileService.register(undefined, buildRepositories(manager), body, lang);
      reply.status(StatusCodes.NO_CONTENT);
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
    reply.status(StatusCodes.NO_CONTENT);
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
      );

      const token = await memberPasswordService.login(
        undefined,
        buildRepositories(),
        body,
        body.challenge,
      );

      // redirect to the deep link end point
      // this ensures that the auth front-end transits through another domain, which will open the app when redirecting to the universal link
      // must use front-end redirection because this will be called AJAX through POST
      const redirectionUrl = new URL('/m/deep-link', PUBLIC_URL);
      redirectionUrl.searchParams.set('t', token);
      reply.status(StatusCodes.SEE_OTHER);

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

  fastify.get(
    '/auth/refresh', // there's a hardcoded reference to this path above: "verifyMemberInAuthToken()"
    { preHandler: fastify.verifyBearerAuth },
    async ({ memberId }) => generateAuthTokensPair(memberId),
  );

  fastify.get<{ Querystring: { t: string } }>(
    '/deep-link',
    { schema: mdeepLink },
    async ({ query: { t } }, reply) => {
      // url to the auth universal link (auth domain is different from our PUBLIC_URL)
      const target = new URL('auth', AUTH_CLIENT_HOST);
      target.searchParams.set('t', t);
      const link = target.toString();

      // redirect manually because we can't mix reply.redirect and an html response (= reply.send) in Fastify
      reply.code(StatusCodes.MOVED_TEMPORARILY);
      reply.header('Location', link);

      reply.type('text/html');
      // TODO: this can be improved
      return `
          <!DOCTYPE html>
          <html>
            <body style="display: flex; justify-content: center; align-items: center; height: 100vh;
              font-family: sans-serif;">
              <a style="background-color: #5050d2;
                color: white;
                padding: 1em 1.5em;
                text-decoration: none;"
                href="${link}">Open with Graasp app</>
            </body>
          </html>
        `;
    },
  );
};

export default plugin;
