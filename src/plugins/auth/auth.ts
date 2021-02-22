// global
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { JsonWebTokenError } from 'jsonwebtoken';

import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import fastifySecureSession from 'fastify-secure-session';
import fastifyJwt from 'fastify-jwt';

import {
  GRAASP_ACTOR, JWT_SECRET, EMAIL_LINKS_HOST, PROTOCOL,
  REGISTER_TOKEN_EXPIRATION_IN_MINUTES,
  LOGIN_TOKEN_EXPIRATION_IN_MINUTES, CLIENT_HOST
} from '../../util/config';

// other services
import { MemberTaskManager } from '../../services/members/task-manager';
import { Member } from '../../services/members/interfaces/member';

// local
import { register, login, auth } from './schemas';

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * Validate session, extract member from it, and set it on `request`.
     * Throws exception if it fails.
     */
    validateSession: (request: FastifyRequest, reply: FastifyReply) => void;
    /**
     * Tries to validate session and extract member from it.
     * Does not fail - simply does not set the `member` decorator on `request`.
     */
    fetchSession: (request: FastifyRequest) => void;
  }
}

interface AuthPluginOptions {
  sessionCookieDomain: string;
  uniqueViolationErrorName?: string;
}

const plugin: FastifyPluginAsync<AuthPluginOptions> = async (fastify, options) => {
  const {
    sessionCookieDomain: domain,
    uniqueViolationErrorName = 'UniqueIntegrityConstraintViolationError' // TODO: can we improve this?
  } = options;
  const { log, db, members: { dbService: mS }, taskRunner: runner } = fastify;
  const memberTaskManager = new MemberTaskManager(mS);

  fastify.register(fastifySecureSession, {
    // TODO: maybe change to 'secret', which is just a string (makes the boot slower).
    // Production needs its own key: https://github.com/fastify/fastify-secure-session#using-a-pregenerated-key
    key: fs.readFileSync(path.join(process.cwd(), 'secure-session-secret-key')),
    cookie: { domain, path: '/' }
  });

  async function validateSession(request: FastifyRequest, reply: FastifyReply) {
    const { session } = request;
    const memberId = session.get('member');

    if (!memberId) {
      reply.status(401);
      throw new Error('no valid session');
    }

    // TODO: do we really need to get the user from the DB? (or actor: { id } is enough?)
    // maybe when the groups are implemented it will be necessary.
    const member = await mS.get(memberId, db.pool) as Member;

    if (!member) {
      reply.status(401);
      session.delete();
      throw new Error('orphan session');
    }

    request.member = member;
  }
  fastify.decorate('validateSession', validateSession);

  async function fetchSession(request: FastifyRequest) {
    const { session } = request;
    const memberId = session.get('member');

    if (!memberId) return;

    // TODO: do we really need to get the user from the DB? (or actor: { id } is enough?)
    // maybe when the groups are implemented it will be necessary.
    request.member = await mS.get(memberId, db.pool) as Member;
  }
  fastify.decorate('fetchSession', fetchSession);

  await fastify.register(fastifyJwt, { secret: JWT_SECRET });

  const promisifiedJwtVerify = promisify<string, { sub: string }>(fastify.jwt.verify);
  const promisifiedJwtSign = promisify<{ sub: string }, { expiresIn: string }, string>(fastify.jwt.sign);

  // register
  fastify.post<{ Body: { name: string; email: string } }>(
    '/register',
    { schema: register },
    async ({ body, log }, reply) => {
      let member, task;

      try {
        // create member
        task = memberTaskManager.createCreateTask(GRAASP_ACTOR, body);
        member = await runner.run([task], log) as Member;

        // generate token with member info and expiration
        const token = await promisifiedJwtSign({ sub: member.id },
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
        task = memberTaskManager.createGetMembersByTask(GRAASP_ACTOR, { email });
        const members = await runner.run([task], log) as Member[];
        member = members[0];

        await generateLoginLinkAndEmailIt(member, true);
      }

      reply.status(204);
    }
  );

  async function generateLoginLinkAndEmailIt(member, reRegistrationAttempt?) {
    // generate token with member info and expiration
    const token = await promisifiedJwtSign({ sub: member.id },
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
      const task = memberTaskManager.createGetMembersByTask(GRAASP_ACTOR, body);
      const members = await runner.run([task], log) as Member[];

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
        const { sub: memberId } = await promisifiedJwtVerify(token);

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
};

export default fp(plugin);
