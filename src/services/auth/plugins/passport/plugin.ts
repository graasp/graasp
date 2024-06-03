import fastifyPassport from '@fastify/passport';
import fastifySecureSession from '@fastify/secure-session';
import { FastifyInstance, FastifyPluginAsync, PassportUser } from 'fastify';

import {
  AUTH_TOKEN_JWT_SECRET,
  COOKIE_DOMAIN,
  JWT_SECRET,
  PROD,
  REFRESH_TOKEN_JWT_SECRET,
  SECURE_SESSION_EXPIRATION_IN_SECONDS,
  SECURE_SESSION_SECRET_KEY,
  STAGING,
} from '../../../../utils/config';
import { Repositories, buildRepositories } from '../../../../utils/repositories';
import { PassportStrategy } from './strategies';
import jwtStrategy from './strategies/jwt';
import jwtAppsStrategy from './strategies/jwtApps';
import jwtChallengeVerifierStrategy from './strategies/jwtChallengeVerifier';
import magicLinkStrategy from './strategies/magicLink';
import passwordStrategy from './strategies/password';
import passwordResetStrategy from './strategies/passwordReset';
import strictSessionStrategy from './strategies/strictSession';

// This plugin needs to be globally register before using the prehandlers.
const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const {
    memberPassword: { service: memberPasswordService },
  } = fastify;
  const repositories: Repositories = buildRepositories();
  const memberRepository = repositories.memberRepository;
  const itemRepository = repositories.itemRepository;

  // Mandatory registration for @fastify/passport
  await fastify
    .register(fastifySecureSession, {
      key: Buffer.from(SECURE_SESSION_SECRET_KEY, 'hex'),
      cookie: { domain: COOKIE_DOMAIN, path: '/', secure: PROD || STAGING, httpOnly: true },
      expiry: SECURE_SESSION_EXPIRATION_IN_SECONDS, // 1 month
    })
    .register(fastifyPassport.initialize())
    .register(fastifyPassport.secureSession());

  //-- Sessions Strategies --//
  strictSessionStrategy(fastifyPassport);

  //-- Password Strategies --//
  passwordStrategy(fastifyPassport, memberPasswordService, repositories, {
    spreadException: true,
  });

  //-- Magic Link Strategies (JWT) --//
  magicLinkStrategy(
    fastifyPassport,
    memberRepository,
    PassportStrategy.MOBILE_MAGIC_LINK,
    'token',
    AUTH_TOKEN_JWT_SECRET,
    { spreadException: true },
  );
  magicLinkStrategy(
    fastifyPassport,
    memberRepository,
    PassportStrategy.WEB_MAGIC_LINK,
    't',
    JWT_SECRET,
    { spreadException: true },
  );

  //-- JWT Strategies --//
  passwordResetStrategy(fastifyPassport, memberPasswordService);
  jwtChallengeVerifierStrategy(fastifyPassport, memberRepository, {
    spreadException: true,
  });
  jwtStrategy(fastifyPassport, memberRepository, PassportStrategy.JWT, JWT_SECRET, {
    spreadException: true,
  });
  jwtStrategy(
    fastifyPassport,
    memberRepository,
    PassportStrategy.REFRESH_TOKEN,
    REFRESH_TOKEN_JWT_SECRET,
    { spreadException: false },
  );
  jwtAppsStrategy(
    fastifyPassport,
    memberRepository,
    itemRepository,
    PassportStrategy.APPS_JWT,
    true,
  );
  jwtAppsStrategy(
    fastifyPassport,
    memberRepository,
    itemRepository,
    PassportStrategy.OPTIONAL_APPS_JWT,
    false,
  );

  // Serialize and Deserialize user
  fastifyPassport.registerUserSerializer(async (user: PassportUser, _req) => user.member!.id);
  fastifyPassport.registerUserDeserializer(async (uuid: string, _req): Promise<PassportUser> => {
    return {
      member: await memberRepository.get(uuid),
    };
  });
};
export default plugin;
