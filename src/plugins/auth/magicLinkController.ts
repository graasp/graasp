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

const plugin: FastifyPluginAsync = async (fastify) => {
  const { log, db, generateRegisterLinkAndEmailIt, generateLoginLinkAndEmailIt } = fastify;

  const memberRepository = db.getRepository(Member);


  // cookie based auth and api endpoints
  await fastify.register(async function (fastify) {
    // add CORS support
    if (fastify.corsPluginOptions) {
      await fastify.register(fastifyCors, fastify.corsPluginOptions);
    }

    // register
    fastify.post<{ Body: { name: string; email: string }; Querystring: { lang?: string } }>(
      '/register',
      { schema: register },
      async ({ body, query: { lang = DEFAULT_LANG }, log }, reply) => {
        // The email is lowercased when the user registers
        // To every subsequents call, it is to the client to ensure the email is sent in lowercase
        // the servers always do a 1:1 match to retrieve the member by email.
        const email = body.email.toLowerCase();

        // check if member w/ email already exists
        const member = await memberRepository.findOneBy({ email });

        if (!member) {
          const newMember = {
            ...body,
            extra: { lang },
          };
          const member = await memberRepository.create(newMember);

          await generateRegisterLinkAndEmailIt(member);
          reply.status(StatusCodes.NO_CONTENT);
        } else {
          log.warn(`Member re-registration attempt for email '${email}'`);
          await generateLoginLinkAndEmailIt(member, true, null, lang);
          throw new MemberAlreadySignedUp({ email });
        }
      },
    );

    // login
    fastify.post<{ Body: { email: string }; Querystring: { lang?: string } }>(
      '/login',
      { schema: login },
      async ({ body, log, query: { lang } }, reply) => {
        const member = await memberRepository.findOneBy({ email: body.email });

        if (member) {
          await generateLoginLinkAndEmailIt(member, null, null, lang);
          reply.status(StatusCodes.NO_CONTENT);
        } else {
          const { email } = body;
          log.warn(`Login attempt with non-existent email '${email}'`);
          throw new MemberNotSignedUp({ email });
        }
      },
    );

    // authenticate
    fastify.get<{ Querystring: { t: string } }>(
      '/auth',
      { schema: auth },
      async (request, reply) => {
        const {
          query: { t: token },
          session,
        } = request;

        try {
          // verify and extract member info
          const { sub: memberId } = await promisifiedJwtVerify(token, JWT_SECRET, {});

          // add member id to session
          session.set('member', memberId);

          if (CLIENT_HOST) {
            reply.redirect(StatusCodes.SEE_OTHER, REDIRECT_URL);
          } else {
            reply.status(StatusCodes.NO_CONTENT);
          }
        } catch (error) {
          session.delete();
          if (AUTH_CLIENT_HOST) {
            // todo: provide more detailed message
            reply.redirect(StatusCodes.SEE_OTHER, `//${AUTH_CLIENT_HOST}?error=true`);
          } else {
            // the token caused the error
            if (error instanceof JsonWebTokenError) {
              // return a custom error when the token expired
              // helps the client know when to request a refreshed token
              if (error instanceof TokenExpiredError) {
                throw new TokenExpired();
              }

              throw new InvalidToken();
            }
            // any other error
            reply.status(StatusCodes.INTERNAL_SERVER_ERROR);
          }

          log.error(error);
          throw error;
        }
      },
    );

    // logout
    fastify.get('/logout', async ({ session }, reply) => {
      // remove session
      session.delete();
      reply.status(204);
    });
  });
};

export default plugin;
