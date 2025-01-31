import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { RecaptchaAction } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { resolveDependency } from '../../../../di/utils';
import { asDefined } from '../../../../utils/assertions';
import {
  LOGIN_TOKEN_EXPIRATION_IN_MINUTES,
  MOBILE_DEEP_LINK_PROTOCOL,
} from '../../../../utils/config';
import { buildRepositories } from '../../../../utils/repositories';
import { isMember } from '../../../member/entities/member';
import { MemberService } from '../../../member/service';
import { generateAuthTokensPair, getRedirectionLink } from '../../utils';
import captchaPreHandler from '../captcha';
import {
  SHORT_TOKEN_PARAM,
  authenticateJWTChallengeVerifier,
  authenticateMobileMagicLink,
  authenticatePassword,
  authenticateRefreshToken,
} from '../passport';
import { MemberPasswordService } from '../password/service';
import { authWeb, mPasswordLogin, mauth, mlogin, mregister } from './schemas';
import { MobileService } from './service';

// token based auth and endpoints for mobile
const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { log, db } = fastify;

  const mobileService = resolveDependency(MobileService);
  const memberPasswordService = resolveDependency(MemberPasswordService);
  const memberService = resolveDependency(MemberService);

  // no need to add CORS support here - only used by mobile app

  fastify.post(
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

  fastify.post(
    '/login',
    {
      schema: mlogin,
      preHandler: captchaPreHandler(RecaptchaAction.SignInMobile),
    },
    async (request, reply) => {
      const { body } = request;

      await mobileService.login(undefined, buildRepositories(), body);
      reply.status(StatusCodes.NO_CONTENT);
    },
  );

  // login with password
  fastify.post(
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
        user,
        body: { challenge },
      } = request;
      const member = asDefined(user?.account);

      const token = memberPasswordService.generateToken(
        { sub: member.id, challenge: challenge },
        // Expiration duration is given in {XX}m format (e.g. 30m) to indicate the minutes.
        `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
      );

      // redirect to the universal link domain
      const redirectionUrl = new URL(`${MOBILE_DEEP_LINK_PROTOCOL}//auth`);
      redirectionUrl.searchParams.set(SHORT_TOKEN_PARAM, token);
      reply.status(StatusCodes.SEE_OTHER);

      return { resource: redirectionUrl.toString() };
    },
  );

  fastify.post(
    '/auth',
    {
      schema: mauth,
      preHandler: authenticateJWTChallengeVerifier,
    },
    async ({ user, authInfo }) => {
      const member = asDefined(user?.account);
      await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        await memberService.refreshLastAuthenticatedAt(member.id, repositories);
        // on auth, if the user used the email sign in, its account gets validated
        if (authInfo?.emailValidation && isMember(member) && !member.isValidated) {
          await memberService.validate(member.id, repositories);
        }
      });
      return generateAuthTokensPair(member.id);
    },
  );

  fastify.get(
    '/auth/refresh',
    {
      preHandler: authenticateRefreshToken,
    },
    async ({ user }) => {
      const member = asDefined(user?.account);
      return generateAuthTokensPair(member.id);
    },
  );

  // from user token, set corresponding cookie
  fastify.get(
    '/auth/web',
    {
      schema: authWeb,
      preHandler: authenticateMobileMagicLink,
    },
    async ({ query }, reply) => {
      const redirectionUrl = getRedirectionLink(
        log,
        query.url ? decodeURIComponent(query.url) : undefined,
      );
      reply.redirect(StatusCodes.SEE_OTHER, redirectionUrl);
    },
  );
};

export default plugin;
