import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import jwt, { Secret, SignOptions, TokenExpiredError, VerifyOptions } from 'jsonwebtoken';
import { JsonWebTokenError } from 'jsonwebtoken';
import { promisify } from 'util';

import fastifyAuth from '@fastify/auth';
import fastifyBearerAuth from '@fastify/bearer-auth';
import fastifyCors from '@fastify/cors';
import fastifySecureSession from '@fastify/secure-session';
import { FastifyBaseLogger, FastifyPluginAsync, FastifyRequest } from 'fastify';

import { Member } from '../../services/members/member';
import { TaskManager as MemberTaskManager } from '../../services/members/task-manager';
import {
  AUTH_CLIENT_HOST,
  AUTH_TOKEN_EXPIRATION_IN_MINUTES,
  AUTH_TOKEN_JWT_SECRET,
  CLIENT_HOST,
  DEFAULT_LANG,
  EMAIL_LINKS_HOST,
  GRAASP_ACTOR,
  JWT_SECRET,
  LOGIN_TOKEN_EXPIRATION_IN_MINUTES,
  PROD,
  PROTOCOL,
  REDIRECT_URL,
  REFRESH_TOKEN_EXPIRATION_IN_MINUTES,
  REFRESH_TOKEN_JWT_SECRET,
  REGISTER_TOKEN_EXPIRATION_IN_MINUTES,
  SECURE_SESSION_SECRET_KEY,
  STAGING,
  TOKEN_BASED_AUTH,
} from '../../util/config';
import {
  EmptyCurrentPassword,
  IncorrectPassword,
  InvalidPassword,
  InvalidSession,
  InvalidToken,
  MemberAlreadySignedUp,
  MemberNotSignedUp,
  MemberWithoutPassword,
  OrphanSession,
  TokenExpired,
} from '../../util/graasp-error';
import { SALT_ROUNDS } from './constants';
import { AuthPluginOptions } from './interfaces/auth';
import magicLinkController from './magicLinkController';
import mobileController from './mobileController';
import passwordController from './passwordController';
import {
  auth,
  login,
  mPasswordLogin,
  mauth,
  mdeepLink,
  mlogin,
  mregister,
  passwordLogin,
  register,
  updatePassword,
} from './schemas';

declare module 'fastify' {
  interface FastifyInstance {
    generateAuthTokensPair: (memberId: string) => Promise<{
      authToken: string;
      refreshToken: string;
    }>;
    generateRegisterLinkAndEmailIt: (
      member: Partial<Member>, // todo: force some content
      challenge?: string,
    ) => Promise<{
      authToken: string;
      refreshToken: string;
    }>;
    generateLoginLinkAndEmailIt: (
      member: Member,
      idontknow: boolean,
      challenge: string,
      lang: string,
    ) => Promise<{
      authToken: string;
      refreshToken: string;
    }>;
  }

  interface FastifyRequest {
    member: Member
  }
}

const promisifiedJwtVerify = promisify<
  string,
  Secret,
  VerifyOptions,
  { sub: string; challenge?: string }
>(jwt.verify);
const promisifiedJwtSign = promisify<
  { sub: string; challenge?: string },
  Secret,
  SignOptions,
  string
>(jwt.sign);

const plugin: FastifyPluginAsync<AuthPluginOptions> = async (fastify, options) => {
  const { sessionCookieDomain: domain } = options;
  const { db } = fastify;

  const memberRepository = db.getRepository(Member);

  // cookie based auth
  await fastify.register(fastifySecureSession, {
    key: Buffer.from(SECURE_SESSION_SECRET_KEY, 'hex'),
    cookie: { domain, path: '/', secure: PROD || STAGING },
  });

  async function verifyMemberInSession(request: FastifyRequest) {
    const { session } = request;
    const memberId = session.get('member');

    if (!memberId) {
      throw new InvalidSession();
    }

    // TODO: do we really need to get the user from the DB? (or actor: { id } is enough?)
    // maybe when the groups are implemented it will be necessary.
    const member = await memberRepository.findOneBy({ id: memberId });

    if (!member) {
      session.delete();
      throw new OrphanSession();
    }

    request.member = member;
  }

  async function fetchMemberInSession(request: FastifyRequest) {
    const { session } = request;
    const memberId = session.get('member');

    if (!memberId) return;

    // TODO: do we really need to get the user from the DB? (or actor: { id } is enough?)
    // maybe when the groups are implemented it will be necessary.
    request.member = await memberRepository.findOneBy({ id: memberId });
  }

  fastify.decorate('validateSession', verifyMemberInSession);

  // for token based auth
  async function verifyMemberInAuthToken(jwtToken: string, request: FastifyRequest) {
    try {
      const { routerPath } = request;
      const refreshing = '/m/auth/refresh' === routerPath;
      const secret = refreshing ? REFRESH_TOKEN_JWT_SECRET : AUTH_TOKEN_JWT_SECRET;

      const { sub: memberId } = await promisifiedJwtVerify(jwtToken, secret, {});

      if (refreshing) {
        request.memberId = memberId;
      } else {
        const member = await memberRepository.findOneBy({ id: memberId });
        if (!member) return false;
        request.member = member;
      }

      return true;
    } catch (error) {
      const { log } = request;
      log.warn('Invalid auth token');
      return false;
    }
  }

  await fastify.register(fastifyAuth);
  await fastify.register(fastifyBearerAuth, {
    addHook: false,
    keys: new Set<string>(),
    auth: verifyMemberInAuthToken,
  });

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

  const getLangFromMember = (member, defaultLang?): string => member.extra?.lang ?? defaultLang;

  async function generateAuthTokensPair(
    memberId: string,
  ): Promise<{ authToken: string; refreshToken: string }> {
    const [authToken, refreshToken] = await Promise.all([
      promisifiedJwtSign({ sub: memberId }, AUTH_TOKEN_JWT_SECRET, {
        expiresIn: `${AUTH_TOKEN_EXPIRATION_IN_MINUTES}m`,
      }),
      promisifiedJwtSign({ sub: memberId }, REFRESH_TOKEN_JWT_SECRET, {
        expiresIn: `${REFRESH_TOKEN_EXPIRATION_IN_MINUTES}m`,
      }),
    ]);
    return { authToken, refreshToken };
  }
  fastify.decorate('generateAuthTokensPair', generateAuthTokensPair);

  async function generateRegisterLinkAndEmailIt(member, challenge?) {
    // generate token with member info and expiration
    const token = await promisifiedJwtSign({ sub: member.id, challenge }, JWT_SECRET, {
      expiresIn: `${REGISTER_TOKEN_EXPIRATION_IN_MINUTES}m`,
    });

    const linkPath = challenge ? '/m/deep-link' : '/auth';
    const link = `${PROTOCOL}://${EMAIL_LINKS_HOST}${linkPath}?t=${token}`;

    console.log(link);
    // don't wait for mailer's response; log error and link if it fails.
    // fastify.mailer
    //   .sendRegisterEmail(member, link, getLangFromMember(member))
    //   .catch((err) => log.warn(err, `mailer failed. link: ${link}`));
  }

  fastify.decorate('generateRegisterLinkAndEmailIt', generateRegisterLinkAndEmailIt);

  async function generateLoginLinkAndEmailIt(
    member: Member,
    reRegistrationAttempt?: boolean,
    challenge?: string,
    lang?: string,
  ) {
    // generate token with member info and expiration
    const token = await promisifiedJwtSign({ sub: member.id, challenge }, JWT_SECRET, {
      expiresIn: `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
    });

    const linkPath = challenge ? '/m/deep-link' : '/auth';
    const link = `${PROTOCOL}://${EMAIL_LINKS_HOST}${linkPath}?t=${token}`;
    
    console.log(link);

    // don't wait for mailer's response; log error and link if it fails.
    // fastify.mailer
    //   .sendLoginEmail(member, link, reRegistrationAttempt, getLangFromMember(member, lang))
    //   .catch((err) => log.warn(err, `mailer failed. link: ${link}`));
  }

  fastify.decorate('generateLoginLinkAndEmailIt', generateLoginLinkAndEmailIt);

  fastify.register(magicLinkController);
  fastify.register(mobileController, { prefix: '/m' });
  fastify.register(passwordController);
};

export default plugin;
