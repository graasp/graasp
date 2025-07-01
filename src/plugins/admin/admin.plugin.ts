import { StatusCodes } from 'http-status-codes';
import { Profile as GitHubProfile, Strategy as GitHubStrategy } from 'passport-github2';

import { createError } from '@fastify/error';
import { Authenticator } from '@fastify/passport';
import { fastifySecureSession } from '@fastify/secure-session';
import { FastifyInstance, FastifyRequest } from 'fastify';

import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } from '../../config/admin';
import { PROD } from '../../config/env';
import {
  ADMIN_SESSION_EXPIRATION_IN_SECONDS,
  ADMIN_SESSION_SECRET_KEY,
} from '../../config/secrets';
import { db } from '../../drizzle/db';
import { PUBLIC_URL } from '../../utils/config';
import { queueDashboardPlugin } from '../../workers/dashboard.controller';
import { AdminRepository, AdminUser } from './admin.repository';

// module augmentation so the types are right when getting the admin user
// this interface can be used in place of the FastifyRequest in request handlers to get correct typing when inside the admin plugin.
// we use this manual approache to not pollute the global type system with type augmentation.
interface AdminRequest extends FastifyRequest {
  admin?: AdminUser;
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
  // declare a new authenticator so that passport for admins does not interfere with the user passport strategies
  // also set the user property to `admin` so that it will be available on `request.admin`
  const adminPassport = new Authenticator({ userProperty: 'admin' });
  await fastify.register(adminPassport.initialize());
  await fastify.register(adminPassport.secureSession());

  adminPassport.use(
    GITHUB_OAUTH_STRATEGY,
    new GitHubStrategy(
      {
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: `${PUBLIC_URL.origin}/admin/auth/github/callback`,
      },
      async (accessToken: string, refreshToken: string, profile: GitHubProfile, done) => {
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

  adminPassport.registerUserSerializer(async (user: GitHubProfile, req: AdminRequest) => {
    req.log.info(user);
    return user.id;
  });
  adminPassport.registerUserDeserializer(
    async (uuid: string, req: AdminRequest): Promise<{ admin: AdminUser | undefined }> => {
      req.log.info('uuuid', uuid);

      const admin = await adminRepository.get(db, uuid);

      return { admin };
    },
  );

  fastify.get(
    '/admin/auth/github',
    {
      preValidation: adminPassport.authenticate(GITHUB_OAUTH_STRATEGY, { scope: ['user:email'] }),
    },
    async (_request: AdminRequest, _reply) => {},
  );

  fastify.get(
    '/admin/auth/github/callback',
    {
      preValidation: adminPassport.authenticate(GITHUB_OAUTH_STRATEGY, {
        failureRedirect: '/admin/login',
      }),
    },
    async (_request: AdminRequest, reply) => {
      reply.redirect('/admin');
    },
  );

  // login page when user is not authenticated
  fastify.get('/admin/login', async (_request: AdminRequest, reply) => {
    reply.type('text/html').send('<a href="/admin/auth/github">Login with GitHub</a>');
  });

  // this redirects all unauthenticated requests to the login
  // only /admin/login and /admin/auth/github should be let through to prevent redirection loops
  fastify.addHook('preHandler', (request: AdminRequest, reply, done) => {
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
  fastify.get('/admin', async (request: AdminRequest, reply) => {
    request.log.info(request.admin);
    reply.type('text/html').send(
      `Hello, ${request.admin?.userName || 'admin'}!
        <a href="/admin/logout">Logout</a><br/>
        <a href="/admin/queues/ui">Queue Dashboard</a>
        `,
    );
  });

  fastify.get('/admin/logout', async (request: AdminRequest, reply) => {
    await request.logout();
    reply.redirect('/admin/login');
  });

  // register the queue Dashboard for BullMQ
  // warning inside this module it registers the path as absolute,
  // so we should beware that when moving the registration we should also update the absolute paths
  fastify.register(queueDashboardPlugin);
};
