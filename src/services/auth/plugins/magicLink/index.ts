import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { DEFAULT_LANG } from '@graasp/sdk';

import { AUTH_CLIENT_HOST, CLIENT_HOST, REDIRECT_URL } from '../../../../util/config';
import { MemberAlreadySignedUp } from '../../../../util/graasp-error';
import { buildRepositories } from '../../../../util/repositories';
import { auth, login, register } from '../../schemas';
import { MagicLinkService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    log,
    db,
    members: { service: memberService },
  } = fastify;

  const magicLinkService = new MagicLinkService(fastify, log);

  // cookie based auth and api endpoints
  await fastify.register(async function (fastify) {
    // register
    fastify.post<{ Body: { name: string; email: string }; Querystring: { lang?: string } }>(
      '/register',
      { schema: register },
      async ({ body, query: { lang = DEFAULT_LANG }, log }, reply) => {
        // TODO: not best, too much logic here
        return db.transaction(async (manager) => {
          try {
            // we use member service to allow post hook for invitation
            const member = await memberService.post(
              undefined,
              buildRepositories(manager),
              body,
              lang,
            );

            await magicLinkService.sendRegisterMail(null, buildRepositories(manager), member);
            reply.status(StatusCodes.NO_CONTENT);
          } catch (e) {
            if (!(e instanceof MemberAlreadySignedUp)) {
              throw e;
            }
            // send login email
            await magicLinkService.login(null, buildRepositories(manager), body, lang);
            reply.status(StatusCodes.NO_CONTENT);
          }
        });
      },
    );

    // login
    fastify.post<{ Body: { email: string }; Querystring: { lang?: string } }>(
      '/login',
      { schema: login },
      async ({ body, query: { lang } }, reply) => {
        await magicLinkService.login(null, buildRepositories(), body, lang);
        reply.status(StatusCodes.NO_CONTENT);
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
          const { sub: memberId } = await magicLinkService.auth(null, buildRepositories(), token);

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
            log.error(error);
            throw error;
          }
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
