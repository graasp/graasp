import fastifyPassport from '@fastify/passport';
import fastifySecureSession from '@fastify/secure-session';
import { FastifyInstance, FastifyPluginAsync, PassportUser } from 'fastify';

import {
  AUTH_TOKEN_JWT_SECRET,
  COOKIE_DOMAIN,
  JWT_SECRET,
  PROD,
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
import refreshTokenStrategy from './strategies/refreshToken';
import strictSessionStrategy from './strategies/strictSession';

const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const {
    log,
    memberPassword: { service: memberPasswordService },
  } = fastify;
  const repositories: Repositories = buildRepositories();
  const memberRepository = repositories.memberRepository;
  const itemRepository = repositories.itemRepository;

  // cookie based auth
  await fastify
    .register(fastifySecureSession, {
      key: Buffer.from(SECURE_SESSION_SECRET_KEY, 'hex'),
      cookie: { domain: COOKIE_DOMAIN, path: '/', secure: PROD || STAGING, httpOnly: true },
      expiry: 2592000000, // 1 month
    })
    .register(fastifyPassport.initialize())
    .register(fastifyPassport.secureSession());

  strictSessionStrategy(fastifyPassport);

  //-- Password Strategies --//
  passwordStrategy(fastifyPassport, log.info, memberPasswordService, repositories, {
    spreadException: true,
  });
  passwordResetStrategy(fastifyPassport, memberPasswordService);

  //-- Magic Link Strategies --//
  magicLinkStrategy(
    fastifyPassport,
    log.info,
    memberRepository,
    PassportStrategy.MOBILE_MAGIC_LINK,
    'token',
    AUTH_TOKEN_JWT_SECRET,
    { spreadException: true },
  );
  magicLinkStrategy(
    fastifyPassport,
    log.info,
    memberRepository,
    PassportStrategy.WEB_MAGIC_LINK,
    't',
    JWT_SECRET,
    { spreadException: true },
  );

  //-- JWT Strategies --//
  jwtChallengeVerifierStrategy(fastifyPassport, log.info, memberRepository, {
    spreadException: true,
  });
  refreshTokenStrategy(fastifyPassport, log.info, memberRepository, { spreadException: false });
  jwtStrategy(fastifyPassport, log.info, memberRepository, PassportStrategy.JWT, JWT_SECRET, {
    spreadException: true,
  });
  jwtAppsStrategy(
    fastifyPassport,
    log.info,
    memberRepository,
    itemRepository,
    PassportStrategy.APPS_JWT,
    true,
  );
  jwtAppsStrategy(
    fastifyPassport,
    log.info,
    memberRepository,
    itemRepository,
    PassportStrategy.OPTIONAL_APPS_JWT,
    false,
  );

  // Register user object to session
  fastifyPassport.registerUserSerializer(async (user: PassportUser, _req) => user.member!.id);
  fastifyPassport.registerUserDeserializer(async (uuid: string, _req): Promise<PassportUser> => {
    return {
      member: await memberRepository.get(uuid),
    };
  });
};
export default plugin;
