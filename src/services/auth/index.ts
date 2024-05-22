import fastifyAuth from '@fastify/auth';
import fastifyBearerAuth from '@fastify/bearer-auth';
import fastifyCors from '@fastify/cors';
import fastifySecureSession from '@fastify/secure-session';
import { FastifyPluginAsync } from 'fastify';

import {
  PROD,
  RECAPTCHA_SECRET_ACCESS_KEY,
  SECURE_SESSION_SECRET_KEY,
  STAGING,
  TOKEN_BASED_AUTH,
} from '../../utils/config';
import { AuthPluginOptions } from './interfaces/auth';
import captchaPlugin from './plugins/captcha';
import magicLinkController from './plugins/magicLink';
import mobileController from './plugins/mobile';
import passwordController from './plugins/password';
import { AuthService } from './service';
import {
  fetchMemberInSession,
  generateAuthTokensPair,
  verifyMemberInAuthToken,
  verifyMemberInSession,
} from './utils';

const plugin: FastifyPluginAsync<AuthPluginOptions> = async (fastify, options) => {
  const { sessionCookieDomain: domain } = options;
  const { log, mailer } = fastify;

  const authService = new AuthService(mailer, log);

  // cookie based auth
  await fastify.register(fastifySecureSession, {
    key: Buffer.from(SECURE_SESSION_SECRET_KEY, 'hex'),
    cookie: { domain, path: '/', secure: PROD || STAGING, httpOnly: true },
  });

  // captcha
  await fastify.register(captchaPlugin, { secretAccessKey: RECAPTCHA_SECRET_ACCESS_KEY });

  fastify.decorate('fetchMemberInSession', fetchMemberInSession);

  fastify.decorate('validateSession', verifyMemberInSession);

  await fastify.register(fastifyAuth);
  await fastify.register(fastifyBearerAuth, {
    addHook: false,
    keys: new Set<string>(),
    auth: verifyMemberInAuthToken,
  });

  if (!fastify.verifyBearerAuth) {
    throw new Error('verifyBearerAuth is not defined');
  }

  fastify.decorate(
    'attemptVerifyAuthentication',
    TOKEN_BASED_AUTH
      ? fastify.auth([
          verifyMemberInSession,
          fastify.verifyBearerAuth,
          // this will make the chain of auth schemas to never fail,
          // which is what we want to happen with this auth hook
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          async () => {},
        ])
      : fetchMemberInSession, // this hook, by itself, will also never fail
  );

  const verifyAuthentication = TOKEN_BASED_AUTH
    ? fastify.auth([verifyMemberInSession, fastify.verifyBearerAuth])
    : verifyMemberInSession;

  fastify.decorate('verifyAuthentication', verifyAuthentication);

  fastify.decorate('generateAuthTokensPair', generateAuthTokensPair);

  // TODO: decorate auth service and use it instead of decorating function
  fastify.decorate('generateRegisterLinkAndEmailIt', authService.generateRegisterLinkAndEmailIt);

  fastify.decorate('generateLoginLinkAndEmailIt', authService.generateLoginLinkAndEmailIt);

  await fastify.register(async function (fastify) {
    // add CORS support
    if (fastify.corsPluginOptions) {
      await fastify.register(fastifyCors, fastify.corsPluginOptions);
    }
    await fastify.register(magicLinkController);
    await fastify.register(passwordController);
    await fastify.register(mobileController, { prefix: '/m' });
  });
};

export default plugin;
