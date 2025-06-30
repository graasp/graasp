import { Strategy as GitHubStrategy } from 'passport-github2';

import fastifyPassport from '@fastify/passport';
import { fastifySecureSession } from '@fastify/secure-session';
import { FastifyInstance, PassportUser } from 'fastify';

import { PROD } from '../../config/env';
import {
  ADMIN_SESSION_EXPIRATION_IN_SECONDS,
  ADMIN_SESSION_SECRET_KEY,
} from '../../config/secrets';
import { db } from '../../drizzle/db';
import { assertIsDefined } from '../../utils/assertions';
import { AdminRepository } from '../admin.repository';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'YOUR_CLIENT_ID';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';

const GITHUB_OAUTH_STRATEGY = 'github-admin';

export default async (fastify: FastifyInstance) => {
  const adminRepository = new AdminRepository();

  fastify.register(fastifySecureSession, {
    key: Buffer.from(ADMIN_SESSION_SECRET_KEY, 'hex'),
    cookie: {
      path: '/admin',
      secure: PROD,
      httpOnly: true,
      maxAge: ADMIN_SESSION_EXPIRATION_IN_SECONDS,
    },
    expiry: ADMIN_SESSION_EXPIRATION_IN_SECONDS,
  });
  await fastify.register(fastifyPassport.initialize());
  await fastify.register(fastifyPassport.secureSession());

  fastifyPassport.use(
    GITHUB_OAUTH_STRATEGY,
    new GitHubStrategy(
      {
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: 'http://localhost:3000/admin/auth/github/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        // only allow users that are present in the admin table by their username
        if (await adminRepository.isAdmin(db, profile.username)) {
          // You can add admin checks here
          return done(null, profile);
        }
      },
    ),
  );

  fastifyPassport.registerUserSerializer(async (user: PassportUser, _req) => {
    _req.log.info(user);
    assertIsDefined(user.admin);
    return user.admin.id;
  });
  fastifyPassport.registerUserDeserializer(async (uuid: string, _req): Promise<PassportUser> => {
    _req.log.info('uuuid', uuid);

    const admin = await adminRepository.get(db, uuid);

    return { admin };
  });

  fastify.get(
    '/admin/auth/github',
    {
      preValidation: fastifyPassport.authenticate(GITHUB_OAUTH_STRATEGY, { scope: ['user:email'] }),
    },
    async (_request, _reply) => {},
  );

  fastify.get(
    '/admin/auth/github/callback',
    {
      preValidation: fastifyPassport.authenticate(GITHUB_OAUTH_STRATEGY, {
        failureRedirect: '/admin/login',
      }),
    },
    async (request, reply) => {
      request.log.info('callback user', request.user);
      reply.redirect('/admin');
    },
  );

  fastify.get('/admin/login', async (_request, reply) => {
    reply.type('text/html').send('<a href="/admin/auth/github">Login with GitHub</a>');
  });

  fastify.addHook('preHandler', (request, reply, done) => {
    const url = request.raw.url || '';
    if (
      url.startsWith('/admin') &&
      !url.startsWith('/admin/login') &&
      !url.startsWith('/admin/auth/github') &&
      !request.isAuthenticated()
    ) {
      reply.redirect('/admin/login');
    } else {
      done();
    }
  });

  fastify.get('/admin', async (request, reply) => {
    reply
      .type('text/html')
      .send(
        `Hello, ${request.user?.admin?.userName || 'admin'}! <a href="/admin/logout">Logout</a>`,
      );
  });

  fastify.get('/admin/logout', async (request, reply) => {
    await request.logout();
    reply.redirect('/admin/login');
  });
};
