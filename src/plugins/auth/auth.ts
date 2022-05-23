// global
import crypto from 'crypto';
import jwt, { Secret, VerifyOptions, SignOptions, TokenExpiredError } from 'jsonwebtoken';
import { promisify } from 'util';
import { JsonWebTokenError } from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';

import { FastifyRequest, FastifyPluginAsync } from 'fastify';
import fastifyAuth from '@fastify/auth';
import fastifySecureSession from '@fastify/secure-session';
import fastifyBearerAuth from '@fastify/bearer-auth';
import fastifyCors from 'fastify-cors';
import bcrypt from 'bcrypt';

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
  DEFAULT_LANG,
} from '../../util/config';

// other services
import { TaskManager as MemberTaskManager } from '../../services/members/task-manager';

// local
import {
  register,
  login,
  passwordLogin,
  auth,
  mlogin,
  mPasswordLogin,
  mauth,
  mdeepLink,
  mregister,
} from './schemas';
import { AuthPluginOptions } from './interfaces/auth';
import { Member } from '../..';
import {
  IncorrectPassword,
  InvalidSession,
  InvalidToken,
  MemberAlreadySignedUp,
  MemberNotSignedUp,
  MemberWithoutPassword,
  OrphanSession,
  TokenExpired,
} from '../../util/graasp-error';

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

  async function verifyMemberInSession(request: FastifyRequest) {
    const { session } = request;
    const memberId = session.get('member');

    if (!memberId) {
      throw new InvalidSession();
    }

    // TODO: do we really need to get the user from the DB? (or actor: { id } is enough?)
    // maybe when the groups are implemented it will be necessary.
    const member = await mS.get(memberId, db.pool);

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

    // don't wait for mailer's response; log error and link if it fails.
    fastify.mailer
      .sendRegisterEmail(member, link, getLangFromMember(member))
      .catch((err) => log.warn(err, `mailer failed. link: ${link}`));
  }

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

    // don't wait for mailer's response; log error and link if it fails.
    fastify.mailer
      .sendLoginEmail(member, link, reRegistrationAttempt, getLangFromMember(member, lang))
      .catch((err) => log.warn(err, `mailer failed. link: ${link}`));
  }

  async function verifyCredentials(member: Member, body: { email: string; password: string }) {
    /* the verified variable is used to store the output of bcrypt.compare() 
    bcrypt.compare() allows to compare the provided password with a stored hash. 
    It deduces the salt from the hash and is able to then hash the provided password correctly for comparison
    if they match, verified is true 
    if they do not match, verified is false
    */
    const verified = bcrypt
      .compare(body.password, member.password)
      .then((res) => res)
      .catch((err) => console.error(err.message));
    return verified;
  }

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
        const task = memberTaskManager.createGetByTask(GRAASP_ACTOR, { email });
        const [member] = await runner.runSingle(task, log);

        if (!member) {
          const task = memberTaskManager.createCreateTask(GRAASP_ACTOR, {
            ...body,
            extra: { lang },
          });
          const member = await runner.runSingle(task, log);

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
        const task = memberTaskManager.createGetByTask(GRAASP_ACTOR, body);
        const [member] = await runner.runSingle(task, log);

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

    // login with password
    fastify.post<{ Body: { email: string; password: string } }>(
      '/login-password',
      { schema: passwordLogin },
      async ({ body, log }, reply) => {
        const email = body.email.toLowerCase();
        const task = memberTaskManager.createGetByTask(GRAASP_ACTOR, { email });
        const [member] = await runner.runSingle(task, log);

        if (!member) {
          const { email } = body;
          log.warn(`Login attempt with non-existent email '${email}'`);
          throw new MemberNotSignedUp({ email });
        }
        if (member.password === null) {
          log.warn('Login attempt with non-existent password');
          throw new MemberWithoutPassword({ email });
        }
        const verified = await verifyCredentials(member, body);
        if (!verified) {
          throw new IncorrectPassword(body);
        }

        const token = await promisifiedJwtSign({ sub: member.id }, JWT_SECRET, {
          expiresIn: `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
        });
        // link for graasp web
        const linkPath = '/auth';
        const resource = `${PROTOCOL}://${EMAIL_LINKS_HOST}${linkPath}?t=${token}`;
        reply.status(StatusCodes.SEE_OTHER).send({ resource });
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

  // token based auth and endpoints
  await fastify.register(
    async function (fastify) {
      // no need to add CORS support here - only used by mobile app

      fastify.decorateRequest('memberId', null);

      fastify.post<{
        Body: { name: string; email: string; challenge: string };
        Querystring: { lang?: string };
      }>(
        '/register',
        { schema: mregister },
        async (
          { body: { name, email, challenge }, query: { lang = DEFAULT_LANG }, log },
          reply,
        ) => {
          // The email is lowercased when the user registers
          // To every subsequents call, it is to the client to ensure the email is sent in lowercase
          // the servers always do a 1:1 match to retrieve the member by email.
          email = email.toLowerCase();

          // check if member w/ email already exists
          const task = memberTaskManager.createGetByTask(GRAASP_ACTOR, { email });
          const [member] = await runner.runSingle(task, log);

          if (!member) {
            const task = memberTaskManager.createCreateTask(GRAASP_ACTOR, {
              name,
              email,
              extra: { lang },
            });
            const member = await runner.runSingle(task, log);

            await generateRegisterLinkAndEmailIt(member, challenge);
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
          const task = memberTaskManager.createGetByTask(GRAASP_ACTOR, { email });
          const [member] = await runner.runSingle(task, log);

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
          const task = memberTaskManager.createGetByTask(GRAASP_ACTOR, { email });
          const [member] = await runner.runSingle(task, log);

          if (!member) {
            const { email } = body;
            log.warn(`Login attempt with non-existent email '${email}'`);
            throw new MemberNotSignedUp({ email });
          }
          if (member.password === null) {
            log.warn('Login attempt with non-existent password');
            throw new MemberWithoutPassword({ email });
          }
          const verified = await verifyCredentials(member, body);
          if (!verified) {
            throw new IncorrectPassword(body);
          } else {
            const token = await promisifiedJwtSign({ sub: member.id, challenge }, JWT_SECRET, {
              expiresIn: `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
            });
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
    },
    { prefix: '/m' },
  );
};

export default plugin;
