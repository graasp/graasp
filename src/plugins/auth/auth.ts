// global
import crypto from 'crypto';
import jwt, { Secret, VerifyOptions, SignOptions, TokenExpiredError } from 'jsonwebtoken';
import { promisify } from 'util';
import { JsonWebTokenError } from 'jsonwebtoken';
import { StatusCodes, ReasonPhrases } from 'http-status-codes';

import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import fastifyAuth from 'fastify-auth';
import fastifySecureSession from 'fastify-secure-session';
import fastifyBearerAuth from 'fastify-bearer-auth';
import fastifyCors from 'fastify-cors';

import {
  SECURE_SESSION_SECRET_KEY,
  GRAASP_ACTOR,
  EMAIL_LINKS_HOST,
  PROTOCOL,
  CLIENT_HOST,
  JWT_SECRET,
  REGISTER_TOKEN_EXPIRATION_IN_MINUTES,
  LOGIN_TOKEN_EXPIRATION_IN_MINUTES,
  AUTH_TOKEN_JWT_SECRET,
  AUTH_TOKEN_EXPIRATION_IN_MINUTES,
  TOKEN_BASED_AUTH,
  REFRESH_TOKEN_JWT_SECRET,
  REFRESH_TOKEN_EXPIRATION_IN_MINUTES,
  AUTH_CLIENT_HOST,
} from '../../util/config';

// other services
import { TaskManager as MemberTaskManager } from '../../services/members/task-manager';

// local
import { register, login, auth, mlogin, mauth, mdeepLink, mregister } from './schemas';
import { AuthPluginOptions } from './interfaces/auth';

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
  const {
    log,
    db,
    members: { dbService: mS },
    taskRunner: runner,
  } = fastify;
  const memberTaskManager = new MemberTaskManager(mS);

  // cookie based auth
  await fastify.register(fastifySecureSession, {
    key: Buffer.from(SECURE_SESSION_SECRET_KEY, 'hex'),
    cookie: { domain, path: '/' },
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

    // don't wait for mailer's response; log error and link if it fails.
    fastify.mailer
      .sendRegisterEmail(member, link)
      .catch((err) => log.warn(err, `mailer failed. link: ${link}`));
  }

  async function generateLoginLinkAndEmailIt(member, reRegistrationAttempt?, challenge?) {
    // generate token with member info and expiration
    const token = await promisifiedJwtSign({ sub: member.id, challenge }, JWT_SECRET, {
      expiresIn: `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
    });

    const linkPath = challenge ? '/m/deep-link' : '/auth';
    const link = `${PROTOCOL}://${EMAIL_LINKS_HOST}${linkPath}?t=${token}`;

    // don't wait for mailer's response; log error and link if it fails.
    fastify.mailer
      .sendLoginEmail(member, link, reRegistrationAttempt)
      .catch((err) => log.warn(err, `mailer failed. link: ${link}`));
  }

  // cookie based auth and api endpoints
  await fastify.register(async function (fastify) {
    // add CORS support
    if (fastify.corsPluginOptions) {
      await fastify.register(fastifyCors, fastify.corsPluginOptions);
    }

    // register
    fastify.post<{ Body: { name: string; email: string } }>(
      '/register',
      { schema: register },
      async ({ body, log }, reply) => {
        // The email is lowercased when the user registers
        // To every subsequents call, it is to the client to ensure the email is sent in lowercase
        // the servers always do a 1:1 match to retrieve the member by email.
        const email = body.email.toLowerCase();

        // check if member w/ email already exists
        const task = memberTaskManager.createGetByTask(GRAASP_ACTOR, { email });
        const [member] = await runner.runSingle(task, log);

        if (!member) {
          const task = memberTaskManager.createCreateTask(GRAASP_ACTOR, body);
          const member = await runner.runSingle(task, log);

          await generateRegisterLinkAndEmailIt(member);
          reply.status(StatusCodes.NO_CONTENT);
        } else {
          log.warn(`Member re-registration attempt for email '${email}'`);
          await generateLoginLinkAndEmailIt(member, true);
          reply.status(StatusCodes.CONFLICT).send(ReasonPhrases.CONFLICT);
        }
      },
    );

    // login
    fastify.post<{ Body: { email: string } }>(
      '/login',
      { schema: login },
      async ({ body, log }, reply) => {
        const task = memberTaskManager.createGetByTask(GRAASP_ACTOR, body);
        const [member] = await runner.runSingle(task, log);

        if (member) {
          await generateLoginLinkAndEmailIt(member);
          reply.status(StatusCodes.NO_CONTENT);
        } else {
          const { email } = body;
          log.warn(`Login attempt with non-existent email '${email}'`);
          reply.status(StatusCodes.NOT_FOUND).send(ReasonPhrases.NOT_FOUND);
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
            reply.redirect(StatusCodes.SEE_OTHER, `//${CLIENT_HOST}`);
          } else {
            reply.status(StatusCodes.NO_CONTENT);
          }
        } catch (error) {
            session.delete();
            if (AUTH_CLIENT_HOST) {
              // todo: provide more detailed message
              reply.redirect(StatusCodes.SEE_OTHER, `//${AUTH_CLIENT_HOST}?error=true`);
            }
            else {
              // the token caused the error
              if (error instanceof JsonWebTokenError) {
                reply.status(StatusCodes.UNAUTHORIZED);

                if(error instanceof TokenExpiredError) {
                  reply.status(439);
                }
              }
              // any other error
              else {
                reply.status(StatusCodes.INTERNAL_SERVER_ERROR);
              }
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

  // token based auth and endpoints
  await fastify.register(
    async function (fastify) {
      // no need to add CORS support here - only used by mobile app

      fastify.decorateRequest('memberId', null);

      fastify.post<{ Body: { name: string; email: string; challenge: string } }>(
        '/register',
        { schema: mregister },
        async ({ body: { name, email, challenge }, log }, reply) => {
          // The email is lowercased when the user registers
          // To every subsequents call, it is to the client to ensure the email is sent in lowercase
          // the servers always do a 1:1 match to retrieve the member by email.
          email = email.toLowerCase();

          // check if member w/ email already exists
          const task = memberTaskManager.createGetByTask(GRAASP_ACTOR, { email });
          const [member] = await runner.runSingle(task, log);

          if (!member) {
            const task = memberTaskManager.createCreateTask(GRAASP_ACTOR, { name, email });
            const member = await runner.runSingle(task, log);

            await generateRegisterLinkAndEmailIt(member, challenge);
            reply.status(StatusCodes.NO_CONTENT);
          } else {
            log.warn(`Member re-registration attempt for email '${email}'`);
            await generateLoginLinkAndEmailIt(member, true, challenge);
            reply.status(StatusCodes.CONFLICT).send(ReasonPhrases.CONFLICT);
          }

        },
      );

      fastify.post<{ Body: { email: string; challenge: string } }>(
        '/login',
        { schema: mlogin },
        async ({ body, log }, reply) => {
          const { email, challenge } = body;
          const task = memberTaskManager.createGetByTask(GRAASP_ACTOR, { email });
          const [member] = await runner.runSingle(task, log);

          if (member) {
            await generateLoginLinkAndEmailIt(member, false, challenge);
            reply.status(StatusCodes.NO_CONTENT);
          } else {
            log.warn(`Login attempt with non-existent email '${email}'`);
            reply.status(StatusCodes.NOT_FOUND).send(ReasonPhrases.NOT_FOUND);
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
              reply.status(401);

              if(error instanceof TokenExpiredError) {
                reply.status(439);
              }
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
    },
    { prefix: '/m' },
  );
};

export default plugin;
