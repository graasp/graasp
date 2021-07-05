// global
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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
  AUTH_TOKEN_JWT_SECRET, AUTH_TOKEN_EXPIRATION_IN_MINUTES,
  TOKEN_BASED_AUTH, REFRESH_TOKEN_JWT_SECRET, REFRESH_TOKEN_EXPIRATION_IN_MINUTES
} from '../../util/config';

// other services
import { TaskManager as MemberTaskManager } from '../../services/members/task-manager';
import { Member } from '../../services/members/interfaces/member';

// local
import { register, login, auth, mlogin, mauth } from './schemas';
import { AuthPluginOptions } from './interfaces/auth';

const promisifiedJwtVerify = promisify<string, Secret, VerifyOptions, { sub: string, challenge?: string }>(jwt.verify);
const promisifiedJwtSign = promisify<{ sub: string, challenge?: string }, Secret, SignOptions, string>(jwt.sign);

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

  async function fetchMemberInSession(request: FastifyRequest) {
    const { session } = request;
    const memberId = session.get('member');

    if (!memberId) return;

    // TODO: do we really need to get the user from the DB? (or actor: { id } is enough?)
    // maybe when the groups are implemented it will be necessary.
    request.member = await mS.get(memberId, db.pool);
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

  await fastify
    .register(fastifyAuth)
    .register(fastifyBearerAuth, {
      addHook: false,
      keys: new Set<string>(),
      auth: verifyMemberInAuthToken
    });

  fastify.decorate('attemptVerifyAuthentication',
    TOKEN_BASED_AUTH ?
      fastify.auth([
        verifyMemberInSession,
        fastify.verifyBearerAuth,
        // this will make the chain of auth schemas to never fail,
        // which is what we want to happen with this auth hook
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        async () => { }
      ]) :
      fetchMemberInSession // this hook, by itself, will also never fail
  );

  const verifyAuthentication = TOKEN_BASED_AUTH ?
    fastify.auth([verifyMemberInSession, fastify.verifyBearerAuth]) :
    verifyMemberInSession;

  fastify.decorate('verifyAuthentication', verifyAuthentication);

  async function generateAuthTokensPair(memberId: string): Promise<{ authToken: string, refreshToken: string }> {
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
  fastify.decorate('generateAuthTokensPair', generateAuthTokensPair);

  async function generateLoginLinkAndEmailIt(member, reRegistrationAttempt?, challenge?) {
    // generate token with member info and expiration
    const token = await promisifiedJwtSign({
      sub: member.id,
      challenge,
    }, JWT_SECRET, { expiresIn: `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m` });

    const link = `${PROTOCOL}://${EMAIL_LINKS_HOST}${challenge ? '/m' : ''}/auth?t=${token}`;
    // don't wait for mailer's response; log error and link if it fails.
    fastify.mailer.sendLoginEmail(member, link, reRegistrationAttempt)
      .catch(err => log.warn(err, `mailer failed. link: ${link}`));
  }

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

  // token based auth and endpoints
  fastify.register(async function (fastify) {

    fastify.decorateRequest('memberId', null);

    fastify.post<{ Body: { email: string, challenge: string } }>(
      '/login',
      { schema: mlogin },
      async ({ body, log }, reply) => {
        const { email, challenge } = body;
        const task = memberTaskManager.createGetByTask(GRAASP_ACTOR, { email });
        task.skipActorChecks = true;
        const members = await runner.runSingle(task, log);

        if (members.length) {
          const member = members[0];
          await generateLoginLinkAndEmailIt(member, false, challenge);
        } else {
          log.warn(`Login attempt with non-existent email '${email}'`);
        }

        reply.status(204);
      }
    );

    fastify.post<{ Body: { t: string, verifier: string } }>(
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
            reply.status(401);
          }
          throw error;
        }
      }
    );

    fastify.get(
      '/auth/refresh', // there's a hardcoded reference to this path above: "verifyMemberInAuthToken()"
      { preHandler: fastify.verifyBearerAuth },
      async ({ memberId }) => generateAuthTokensPair(memberId)
    );

  }, { prefix: '/m' });
};

export default fp(plugin);
