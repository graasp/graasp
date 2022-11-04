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
import { FastifyLoggerInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';

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
import { MemberPassword } from './entities/password';
import { AuthPluginOptions } from './interfaces/auth';
import { verifyCredentials } from './passwordController';
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

// TODO: factor out given magic link and password

// token based auth and endpoints for mobile
const plugin: FastifyPluginAsync = async (fastify, ) => {
  const {
    log,
    db,
    generateAuthTokensPair,
    generateRegisterLinkAndEmailIt,
    generateLoginLinkAndEmailIt,
  } = fastify;

  const memberRepository = db.getRepository(Member);
  // TODO: factor out password logic
  const memberPasswordRepository = db.getRepository(MemberPassword);

  // no need to add CORS support here - only used by mobile app

  fastify.decorateRequest('memberId', null);

  fastify.post<{
    Body: { name: string; email: string; challenge: string };
    Querystring: { lang?: string };
  }>(
    '/register',
    { schema: mregister },
    async ({ body: { name, email, challenge }, query: { lang = DEFAULT_LANG }, log }, reply) => {
      // The email is lowercased when the user registers
      // To every subsequents call, it is to the client to ensure the email is sent in lowercase
      // the servers always do a 1:1 match to retrieve the member by email.
      email = email.toLowerCase();

      // check if member w/ email already exists
      const member = await memberRepository.findOneBy({ email });

      if (!member) {
        const newMember = {
          name,
          email,
          extra: { lang },
        };
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await memberRepository.insert(newMember);
        await generateRegisterLinkAndEmailIt(newMember, challenge);
        reply.status(StatusCodes.NO_CONTENT);
      } else {
        log.warn(`Member re-registration attempt for email '${email}'`);
        await generateLoginLinkAndEmailIt(member, true, challenge, lang);
        throw new MemberAlreadySignedUp({ email });
      }
    },
  );

  fastify.post<{ Body: { email: string; challenge: string }; Querystring: { lang?: string } }>(
    '/login',
    { schema: mlogin },
    async ({ body, log, query: { lang } }, reply) => {
      const { email, challenge } = body;
      const member = await memberRepository.findOneBy({ email: body.email });

      if (member) {
        await generateLoginLinkAndEmailIt(member, false, challenge, lang);
        reply.status(StatusCodes.NO_CONTENT);
      } else {
        log.warn(`Login attempt with non-existent email '${email}'`);
        throw new MemberNotSignedUp({ email });
      }
    },
  );

  // login with password
  fastify.post<{ Body: { email: string; challenge: string; password: string } }>(
    '/login-password',
    { schema: mPasswordLogin },
    async ({ body, log }, reply) => {
      const email = body.email.toLowerCase();
      const { challenge } = body;
      const member = await memberRepository.findOneBy({ email });

      if (!member) {
        const { email } = body;
        log.warn(`Login attempt with non-existent email '${email}'`);
        throw new MemberNotSignedUp({ email });
      }
      console.log('woijekfn');
      const memberPassword = await memberPasswordRepository.findOneBy({ member:{id: member.id} });

      if (!memberPassword) {
        log.warn('Login attempt with non-existent password');
        throw new MemberWithoutPassword({ email });
      }
      console.log('tgefv');
      const verified = await verifyCredentials(memberPassword, body, log);
      if (!verified) {
        throw new IncorrectPassword(body);
      } else {
        console.log('rgefsdwrf');
        const token = await promisifiedJwtSign({ sub: member.id, challenge }, JWT_SECRET, {
          expiresIn: `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
        });
        console.log('tgerfds');
        // token for graasp mobile app
        reply.status(StatusCodes.OK).send({ t: token });
      }
    },
  );

  fastify.post<{ Body: { t: string; verifier: string } }>(
    '/auth',
    { schema: mauth },
    async ({ body: { t: token, verifier } }, reply) => {
      try {
        const { sub: memberId, challenge } = await promisifiedJwtVerify(token, JWT_SECRET, {});

        const verifierHash = crypto.createHash('sha256').update(verifier).digest('hex');
        if (challenge !== verifierHash) {
          reply.status(401);
          throw new Error('challenge fail');
        }

        // TODO: should we fetch/test the member from the DB?
        return generateAuthTokensPair(memberId);
      } catch (error) {
        if (error instanceof JsonWebTokenError) {
          // return a custom error when the token expired
          // helps the client know when to request a refreshed token
          if (error instanceof TokenExpiredError) {
            throw new TokenExpired();
          }
          throw new InvalidToken();
        }
        throw error;
      }
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
                href="graasp://auth?t=${t}">Open with Graasp app</>
            </body>
          </html>
        `;
    },
  );
};

export default plugin;
