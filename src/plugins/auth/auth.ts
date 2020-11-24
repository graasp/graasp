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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validateSession: any;
  }
}

const plugin: FastifyPluginAsync<{ sessionCookieDomain: string }> = async (fastify, options) => {
  const { sessionCookieDomain: domain } = options;
  const { log, db, memberService: mS } = fastify;
  const memberTaskManager = new MemberTaskManager(mS, db, log);

  fastify.register(fastifySecureSession, {
    // TODO: maybe change to 'secret', which is just a string (makes the boot slower).
    // Production needs its own key: https://github.com/fastify/fastify-secure-session#using-a-pregenerated-key
    key: fs.readFileSync(path.join(process.cwd(), 'secure-session-secret-key')),
    cookie: { domain }
  });

  // function to validate if the request has a valid session for an existing member
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

  await fastify.register(fastifyJwt, { secret: JWT_SECRET });

  const promisifiedJwtVerify = promisify(fastify.jwt.verify);

  // register
  fastify.post<{ Body: { name: string; email: string } }>(
    '/register',
    { schema: register },
    async ({ body, log }, reply) => {
      // create member
      const task = memberTaskManager.createCreateTask(GRAASP_ACTOR, body);
      // TODO: how to handle "unique integrity constraint" when email already exists?
      // don't bubble up error to client, log something, and
      // send an email with a new link to login and mention that someone
      // tried to (re)register in the platform with this same email.
      const member = await memberTaskManager.run([task], log) as Member;

      // generate token with member info and expiration
      const token = await reply.jwtSign({ sub: member.id },
        { expiresIn: `${REGISTER_TOKEN_EXPIRATION_IN_MINUTES}m` });

      const link = `${PROTOCOL}://${EMAIL_LINKS_HOST}/auth?t=${token}`;
      // don't wait for mailer's response; log error and link if it fails.
      fastify.mailer.sendRegisterEmail(member, link)
        .catch(err => log.warn(err, `mailer failed. link: ${link}`));

      reply.status(204);
    }
  );

  // login
  fastify.post<{ Body: { email: string } }>(
    '/login',
    { schema: login },
    async ({ body, log }, reply) => {
      // get member
      const task = memberTaskManager.createGetByTask(GRAASP_ACTOR, body);
      // TODO: same as in '/register'
      const members = await memberTaskManager.run([task], log) as Member[];

      if (members.length) {
        const member = members[0];
        // generate token with member info and expiration
        const token = await reply.jwtSign({ sub: member.id },
          { expiresIn: `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m` });

        const link = `${PROTOCOL}://${EMAIL_LINKS_HOST}/auth?t=${token}`;
        // don't wait for mailer's response; log error and link if it fails.
        fastify.mailer.sendLoginEmail(member, link)
          .catch(err => log.warn(err, `mailer failed. link: ${link}`));
      } else {
        // TODO: log login try with non existing email
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
        const { sub: memberId } = await promisifiedJwtVerify(token) as { sub: string };

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
