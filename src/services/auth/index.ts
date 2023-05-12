import jwt, { Secret, SignOptions, VerifyOptions } from 'jsonwebtoken';
import { promisify } from 'util';

import fastifyAuth from '@fastify/auth';
import fastifyBearerAuth from '@fastify/bearer-auth';
import fastifyCors from '@fastify/cors';
import fastifySecureSession from '@fastify/secure-session';
import { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { MAIL } from '@graasp/translations';

import {
  AUTH_TOKEN_EXPIRATION_IN_MINUTES,
  AUTH_TOKEN_JWT_SECRET,
  EMAIL_LINKS_HOST,
  JWT_SECRET,
  LOGIN_TOKEN_EXPIRATION_IN_MINUTES,
  PROD,
  PROTOCOL,
  RECAPTCHA_SECRET_ACCESS_KEY,
  REFRESH_TOKEN_EXPIRATION_IN_MINUTES,
  REFRESH_TOKEN_JWT_SECRET,
  REGISTER_TOKEN_EXPIRATION_IN_MINUTES,
  SECURE_SESSION_SECRET_KEY,
  STAGING,
  TOKEN_BASED_AUTH,
} from '../../utils/config';
import { InvalidSession, OrphanSession } from '../../utils/errors';
import { Member } from '../member/entities/member';
import MemberRepository from '../member/repository';
import { AuthPluginOptions } from './interfaces/auth';
import captchaPlugin from './plugins/captcha';
import magicLinkController from './plugins/magicLink';
import mobileController from './plugins/mobile';
import passwordController from './plugins/password';
import { getRedirectionUrl } from './utils';

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
  const { log, mailer } = fastify;

  // cookie based auth
  await fastify.register(fastifySecureSession, {
    key: Buffer.from(SECURE_SESSION_SECRET_KEY, 'hex'),
    cookie: { domain, path: '/', secure: PROD || STAGING, httpOnly: true },
  });

  // captcha
  await fastify.register(captchaPlugin, { secretAccessKey: RECAPTCHA_SECRET_ACCESS_KEY });

  async function verifyMemberInSession(request: FastifyRequest) {
    const { session } = request;
    const memberId = session.get('member');

    if (!memberId) {
      throw new InvalidSession();
    }

    // TODO: do we really need to get the user from the DB? (or actor: { id } is enough?)
    // maybe when the groups are implemented it will be necessary.
    const member = await MemberRepository.findOneBy({ id: memberId });

    if (!member) {
      session.delete();
      throw new OrphanSession();
    }

    request.member = member;
  }

  // set member in request from session if exist
  // used to get authenticated member without throwing
  async function fetchMemberInSession(request: FastifyRequest) {
    const { session } = request;
    const memberId = session.get('member');

    if (!memberId) return;

    // TODO: do we really need to get the user from the DB? (or actor: { id } is enough?)
    // maybe when the groups are implemented it will be necessary.
    request.member = (await MemberRepository.findOneBy({ id: memberId })) ?? undefined;
  }

  fastify.decorate('fetchMemberInSession', fetchMemberInSession);

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
        const member = await MemberRepository.findOneBy({ id: memberId });
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

  if (!fastify.verifyBearerAuth) {
    throw new Error();
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

  async function generateRegisterLinkAndEmailIt(member, options:{challenge?, url?:string}={}) {
    const {challenge, url} = options;

    // generate token with member info and expiration
    const token = await promisifiedJwtSign({ sub: member.id, challenge }, JWT_SECRET, {
      expiresIn: `${REGISTER_TOKEN_EXPIRATION_IN_MINUTES}m`,
    });

    const redirectionUrl = getRedirectionUrl(url);

    const linkPath = challenge ? '/m/deep-link' : '/auth';
    const link = `${PROTOCOL}://${EMAIL_LINKS_HOST}${linkPath}?t=${token}&url=${redirectionUrl}`;

    const lang = getLangFromMember(member);

    const translated = mailer.translate(lang);
    const subject = translated(MAIL.SIGN_UP_TITLE);
    const html = `
    ${mailer.buildText(translated(MAIL.GREETINGS))}
    ${mailer.buildText(translated(MAIL.SIGN_UP_TEXT))}
    ${mailer.buildButton(link, translated(MAIL.SIGN_UP_BUTTON_TEXT))}
    ${mailer.buildText(translated(MAIL.SIGN_UP_NOT_REQUESTED))}`;

    // don't wait for mailer's response; log error and link if it fails.
    mailer
      .sendEmail(subject, member.email, link, html)
      .catch((err) => log.warn(err, `mailer failed. link: ${link}`));
  }

  fastify.decorate('generateRegisterLinkAndEmailIt', generateRegisterLinkAndEmailIt);

  async function generateLoginLinkAndEmailIt(member: Member, options:{challenge?: string, lang?: string, url?:string}={}) {
    const {challenge, lang, url} = options;
    
    // generate token with member info and expiration
    const token = await promisifiedJwtSign({ sub: member.id, challenge }, JWT_SECRET, {
      expiresIn: `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
    });

    const redirectionUrl = getRedirectionUrl(url);
    const linkPath = challenge ? '/m/deep-link' : '/auth';
    const link = `${PROTOCOL}://${EMAIL_LINKS_HOST}${linkPath}?t=${token}&url=${redirectionUrl}`;
    
    const memberLang = getLangFromMember(member) ?? lang;

    const translated = mailer.translate(memberLang);
    const subject = translated(MAIL.SIGN_IN_TITLE);
    const html = `
    ${mailer.buildText(translated(MAIL.SIGN_IN_TEXT))}
    ${mailer.buildButton(link, translated(MAIL.SIGN_IN_BUTTON_TEXT))}
    ${mailer.buildText(translated(MAIL.SIGN_IN_NOT_REQUESTED))}`;

    // don't wait for mailer's response; log error and link if it fails.
    fastify.mailer
      .sendEmail(subject, member.email, link, html)
      .catch((err) => log.warn(err, `mailer failed. link: ${link}`));
  }

  fastify.decorate('generateLoginLinkAndEmailIt', generateLoginLinkAndEmailIt);

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
