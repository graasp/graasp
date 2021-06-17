// global
import fs from 'fs';
import path from 'path';
import jwt, { Secret, VerifyOptions, SignOptions } from 'jsonwebtoken';
import { promisify } from 'util';
import { JsonWebTokenError } from 'jsonwebtoken';

import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifyAuth from 'fastify-auth';
import fastifySecureSession from 'fastify-secure-session';
import fastifyBearerAuth from 'fastify-bearer-auth';

import {
  GRAASP_ACTOR, EMAIL_LINKS_HOST, PROTOCOL, CLIENT_HOST,
  JWT_SECRET, REGISTER_TOKEN_EXPIRATION_IN_MINUTES, LOGIN_TOKEN_EXPIRATION_IN_MINUTES,

  TOKEN_BASED_AUTH,
  AUTH_TOKEN_JWT_SECRET, AUTH_TOKEN_EXPIRATION_IN_MINUTES,
  REFRESH_TOKEN_JWT_SECRET, REFRESH_TOKEN_EXPIRATION_IN_MINUTES
} from '../../util/config';

// other services
import { TaskManager as MemberTaskManager } from '../../services/members/task-manager';
import { Member } from '../../services/members/interfaces/member';

// local
import { register, login, auth } from './schemas';
import { AuthPluginOptions } from './interfaces/auth';

const promisifiedJwtVerify = promisify<string, Secret, VerifyOptions, { sub: string }>(jwt.verify);
const promisifiedJwtSign = promisify<{ sub: string }, Secret, SignOptions, string>(jwt.sign);

const plugin: FastifyPluginAsync<AuthPluginOptions> = async (fastify, options) => {
  const {
    sessionCookieDomain: domain,
    uniqueViolationErrorName = 'UniqueIntegrityConstraintViolationError' // TODO: can we improve this?
  } = options;
  const { log, db, members: { dbService: mS }, taskRunner: runner } = fastify;
  const memberTaskManager = new MemberTaskManager(mS);

  // cookie based auth
  fastify.register(fastifySecureSession, {
    // TODO: maybe change to the 'secret' option, which is just a string (makes the boot slower).
    // Production needs its own key: https://github.com/fastify/fastify-secure-session#using-a-pregenerated-key
    key: fs.readFileSync(path.join(process.cwd(), 'secure-session-secret-key')),
    cookie: { domain, path: '/' }
  });

  async function verifyMemberInSession(request: FastifyRequest, reply: FastifyReply) {
    const { session } = request;
    const memberId = session.get('member');

    if (!memberId) {
      reply.status(401);
      throw new Error('no valid session');
    }

    // TODO: do we really need to get the user from the DB? (or actor: { id } is enough?)
    // maybe when the groups are implemented it will be necessary.
    const member = await mS.get(memberId, db.pool);

    if (!member) {
      reply.status(401);
      session.delete();
      throw new Error('orphan session');
    }

    request.member = member;
  }
  fastify.decorate('validateSession', verifyMemberInSession);
  fastify.decorate('verifyMemberInSession', verifyMemberInSession);

  // TODO: how to cover this case (used in apps) with token base auth???
  async function fetchMemberInSession(request: FastifyRequest) {
    const { session } = request;
    const memberId = session.get('member');

    if (!memberId) return;

    // TODO: do we really need to get the user from the DB? (or actor: { id } is enough?)
    // maybe when the groups are implemented it will be necessary.
    request.member = await mS.get(memberId, db.pool);
  }
  fastify.decorate('fetchSession', fetchMemberInSession);
  fastify.decorate('fetchMemberInSession', fetchMemberInSession);

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
        const member = await mS.get(memberId, db.pool);
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
  fastify.register(fastifyBearerAuth,
    { addHook: false, keys: new Set<string>(), auth: verifyMemberInAuthToken });

  fastify.decorate('verifyMemberInAuthToken', fastify.verifyBearerAuth);

  await fastify.register(fastifyAuth);

  fastify.decorate('verifyMemberInSessionOrAuthToken', fastify.auth([
    verifyMemberInSession,
    // TODO: verifyBearerAuth can only be placed as the last option:
    // https://github.com/fastify/fastify-bearer-auth/issues/90
    fastify.verifyBearerAuth
  ]));

  // cookie based auth and api endpoints
  fastify.register(async function (fastify) {

    fastify.post<{ Body: { name: string; email: string } }>(
      '/register',
      { schema: register },
      async ({ body, log }, reply) => {
        let member: Member;

        try {
          // create member
          const task = memberTaskManager.createCreateTask(GRAASP_ACTOR, body);
          task.skipActorChecks = true;
          member = await runner.runSingle(task, log);

          // generate token with member info and expiration
          const token = await promisifiedJwtSign({ sub: member.id }, JWT_SECRET,
            { expiresIn: `${REGISTER_TOKEN_EXPIRATION_IN_MINUTES}m` });

          const link = `${PROTOCOL}://${EMAIL_LINKS_HOST}/auth?t=${token}`;
          // don't wait for mailer's response; log error and link if it fails.
          fastify.mailer.sendRegisterEmail(member, link)
            .catch(err => log.warn(err, `mailer failed. link: ${link}`));


        } catch (error) {
          if ((error as Error).name !== uniqueViolationErrorName) throw error;

          const { email } = body;
          log.warn(`Member re-registration attempt for email '${email}'`);

          // member already exists - get member and send a login email
          const task = memberTaskManager.createGetByTask(GRAASP_ACTOR, { email });
          task.skipActorChecks = true;
          const members = await runner.runSingle(task, log);
          member = members[0];

          await generateLoginLinkAndEmailIt(member, true);
        }

        reply.status(204);
      }
    );

    async function generateLoginLinkAndEmailIt(member, reRegistrationAttempt?) {
      // generate token with member info and expiration
      const token = await promisifiedJwtSign({ sub: member.id }, JWT_SECRET,
        { expiresIn: `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m` });

      const link = `${PROTOCOL}://${EMAIL_LINKS_HOST}/auth?t=${token}`;
      // don't wait for mailer's response; log error and link if it fails.
      fastify.mailer.sendLoginEmail(member, link, reRegistrationAttempt)
        .catch(err => log.warn(err, `mailer failed. link: ${link}`));
    }

    // login
    fastify.post<{ Body: { email: string } }>(
      '/login',
      { schema: login },
      async ({ body, log }, reply) => {
        const task = memberTaskManager.createGetByTask(GRAASP_ACTOR, body);
        task.skipActorChecks = true;
        const members = await runner.runSingle(task, log);

        if (members.length) {
          const member = members[0];
          await generateLoginLinkAndEmailIt(member);
        } else {
          const { email } = body;
          log.warn(`Login attempt with non-existent email '${email}'`);
        }

        reply.status(204);
      }
    );

    // authenticate
    fastify.get<{ Querystring: { t: string } }>(
      '/auth',
      { schema: auth },
      async (request, reply) => {
        const { query: { t: token }, session } = request;

        try {
          // verify and extract member info
          const { sub: memberId } = await promisifiedJwtVerify(token, JWT_SECRET, {});

          // add member id to session
          session.set('member', memberId);

          if (CLIENT_HOST) {
            reply.redirect(303, `//${CLIENT_HOST}`);
          } else {
            reply.status(204);
          }
        } catch (error) {
          if (error instanceof JsonWebTokenError) {
            session.delete();
            reply.status(401);
          }

          throw error;
        }
      }
    );

    // logout
    fastify.get(
      '/logout',
      async ({ session }, reply) => {
        // remove session
        session.delete();
        reply.status(204);
      }
    );
  });

  // token based auth and api endpoints
  fastify.register(async function (fastify) {

    fastify.decorateRequest('memberId', null);

    async function generateTokensPair(memberId: string): Promise<{ authToken: string, refreshToken: string }> {
      const [authToken, refreshToken] = await Promise.all([
        promisifiedJwtSign(
          { sub: memberId }, AUTH_TOKEN_JWT_SECRET,
          { expiresIn: `${AUTH_TOKEN_EXPIRATION_IN_MINUTES}m` }
        ),
        promisifiedJwtSign(
          { sub: memberId }, REFRESH_TOKEN_JWT_SECRET,
          { expiresIn: `${REFRESH_TOKEN_EXPIRATION_IN_MINUTES}m` }
        )
      ]);
      return { authToken, refreshToken };
    }

    // async function validateRefreshToken(jwtToken: string, request: FastifyRequest) {
    //   try {
    //     // verify token and extract its data
    //     const { sub: memberId } = await promisifiedJwtVerify(jwtToken, REFRESH_TOKEN_JWT_SECRET, {});
    //     // TODO: should we fetch the member from the DB?
    //     request.memberId = memberId;

    //     return true;
    //   } catch (error) {
    //     const { log } = request;
    //     console.log('BUM2!!!');
    //     log.warn('Invalid refresh token');
    //     return false;
    //   }
    // }

    fastify.get<{ Querystring: { t: string } }>(
      '/auth',
      { schema: auth },
      async (request, reply) => {
        const { query: { t: token } } = request;

        try {
          const { sub: memberId } = await promisifiedJwtVerify(token, JWT_SECRET, {});
          // TODO: should we fetch/test the member from the DB?
          return generateTokensPair(memberId);
        } catch (error) {
          if (error instanceof JsonWebTokenError) {
            reply.status(401);
          }
          throw error;
        }
      }
    );

    // fastify.register(fastifyBearerAuth,
    //   { addHook: false, keys: new Set<string>(), auth: validateRefreshToken });

    fastify.get(
      '/auth/refresh',
      { preHandler: fastify.verifyBearerAuth },
      async ({ memberId }) => generateTokensPair(memberId)
    );

  }, { prefix: '/m' });
};

export default fp(plugin);
