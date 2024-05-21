import fastifyAuth from '@fastify/auth';
import fastifyBearerAuth from '@fastify/bearer-auth';
import fastifyCors from '@fastify/cors';
import fastifySecureSession from '@fastify/secure-session';
import { FastifyPluginAsync } from 'fastify';

import { PROD, SECURE_SESSION_SECRET_KEY, STAGING, TOKEN_BASED_AUTH } from '../../utils/config';
import { AuthPluginOptions } from './interfaces/auth';
import magicLinkController from './plugins/magicLink';
import mobileController from './plugins/mobile';
import { plugin as passportPlugin } from './plugins/passport';
import passwordController from './plugins/password';
import {
  fetchMemberInSession,
  generateAuthTokensPair,
  verifyMemberInAuthToken,
  verifyMemberInSession,
} from './utils';

const plugin: FastifyPluginAsync<AuthPluginOptions> = async (fastify, options) => {
  const { sessionCookieDomain: domain } = options;
  const {
    authentication: { service: authService },
  } = fastify;

  // cookie based auth
  await fastify.register(fastifySecureSession, {
    key: Buffer.from(SECURE_SESSION_SECRET_KEY, 'hex'),
    cookie: { domain, path: '/', secure: PROD || STAGING, httpOnly: true },
  });

  fastify.decorate('fetchMemberInSession', fetchMemberInSession);

  fastify.decorate('validateSession', verifyMemberInSession);
  await fastify.register(passportPlugin);
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

  fastify.register(async function (fastify) {
    // add CORS support
    if (fastify.corsPluginOptions) {
      await fastify.register(fastifyCors, fastify.corsPluginOptions);
    }
    fastify.register(magicLinkController);
    fastify.register(passwordController);
    fastify.register(mobileController, { prefix: '/m' });
  });
};

export default plugin;
