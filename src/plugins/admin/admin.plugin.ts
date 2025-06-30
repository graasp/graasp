import { StatusCodes } from 'http-status-codes';
import { Profile as GitHubProfile, Strategy as GitHubStrategy } from 'passport-github2';

import { createError } from '@fastify/error';
import fastifyPassport from '@fastify/passport';
import { fastifySecureSession } from '@fastify/secure-session';
import { FastifyInstance } from 'fastify';

import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } from '../../config/admin';
import { PROD } from '../../config/env';
import {
  ADMIN_SESSION_EXPIRATION_IN_SECONDS,
  ADMIN_SESSION_SECRET_KEY,
} from '../../config/secrets';
import { db } from '../../drizzle/db';
import { PUBLIC_URL } from '../../utils/config';
import { queueDashboardPlugin } from '../../workers/dashboard.controller';
import { AdminRepository, AdminUser } from '../admin.repository';

// module augmentation so the types are right when getting the admin user
declare module 'fastify' {
  interface PassportUser {
    admin?: AdminUser;
  }
}

// name of the passport strategy
const GITHUB_OAUTH_STRATEGY = 'github-admin';

// Common error definions for this module
const NotAnAuthorizedAdmin = createError(
  'GAERR001',
  'User is not an authorized admin',
  StatusCodes.UNAUTHORIZED,
);
const MissingGithubUsername = createError(
  'GAERR002',
  'Response from Github is missing key `username`',
  StatusCodes.BAD_REQUEST,
);

export default async (fastify: FastifyInstance) => {
  const adminRepository = new AdminRepository();

  fastify.register(fastifySecureSession, {
    key: Buffer.from(ADMIN_SESSION_SECRET_KEY, 'hex'),
    cookieName: 'adminSession',
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
        callbackURL: `${PUBLIC_URL.origin}/admin/auth/github/callback`,
      },
      async (accessToken, refreshToken, profile: GitHubProfile, done) => {
        const { username } = profile;
        if (!username) {
          throw new MissingGithubUsername();
        }
        // only allow users that are present in the admin table by their username
        if (await adminRepository.isAdmin(db, username)) {
          console.debug('user is an allowed admin');
          // update info stored in the table
          await adminRepository.update(db, username, { id: profile.id });
          // You can add admin checks here
          return done(null, profile);
        }
        console.debug('user is not an allowed admin', profile);
        return done(new NotAnAuthorizedAdmin());
      },
    ),
  );

  fastifyPassport.registerUserSerializer(async (user: GitHubProfile, req) => {
    req.log.info(user);
    return user.id;
  });
  fastifyPassport.registerUserDeserializer(
    async (uuid: string, req): Promise<{ admin: AdminUser | undefined }> => {
      req.log.info('uuuid', uuid);

      const admin = await adminRepository.get(db, uuid);

      return { admin };
    },
  );

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

  // login page when user is not authenticated
  fastify.get('/admin/login', async (_request, reply) => {
    reply.type('text/html').send('<a href="/admin/auth/github">Login with GitHub</a>');
  });

  // this redirects all unauthenticated requests to the login
  // only /admin/login and /admin/auth/github should be let through to prevent redirection loops
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

  // return the admin home, for the moment it is a bit bare
  fastify.get('/admin', async (request, reply) => {
    request.log.info(request.user);
    reply.type('text/html').send(
      `Hello, ${request.user?.admin?.userName || 'admin'}!
        <a href="/admin/logout">Logout</a><br/>
        <a href="/admin/queue">Queue Dashboard</a>
        `,
    );
  });

  fastify.get('/admin/logout', async (request, reply) => {
    await request.logout();
    reply.redirect('/admin/login');
  });

  // register the queue Dashboard for BullMQ
  // warning inside this module it registers the path as absolute,
  // so we should beware that when moving the registration we should also update the absolute paths
  fastify.register(queueDashboardPlugin);
};
