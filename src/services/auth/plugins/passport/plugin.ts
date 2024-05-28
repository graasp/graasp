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
import { MemberRepository } from '../../../member/repository';
import { PassportStrategy } from './strategies';
import jwtStrategy from './strategies/jwt';
import jwtChallengeVerifierStrategy from './strategies/jwtChallengeVerifier';
import magicLinkStrategy from './strategies/magicLink';
import passwordStrategy from './strategies/password';
import passwordResetStrategy from './strategies/passwordReset';
import refreshTokenStrategy from './strategies/refreshToken';
import strictSessionStrategy from './strategies/strictSession';

const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const {
    memberPassword: { service: memberPasswordService },
  } = fastify;
  const repositories: Repositories = buildRepositories();

  // cookie based auth
  await fastify.register(fastifySecureSession, {
    key: Buffer.from(SECURE_SESSION_SECRET_KEY, 'hex'),
    cookie: { domain: COOKIE_DOMAIN, path: '/', secure: PROD || STAGING, httpOnly: true },
    expiry: 2592000000, // 1 month
  });
  await fastify.register(fastifyPassport.initialize());
  await fastify.register(fastifyPassport.secureSession());

  //-- Password Strategies --//
  passwordStrategy(fastifyPassport, memberPasswordService, repositories);
  passwordResetStrategy(fastifyPassport, memberPasswordService);

  //-- Magic Link Strategies --//
  magicLinkStrategy(
    fastifyPassport,
    repositories.memberRepository,
    PassportStrategy.MOBILE_MAGIC_LINK,
    'token',
    AUTH_TOKEN_JWT_SECRET,
  );
  magicLinkStrategy(
    fastifyPassport,
    repositories.memberRepository,
    PassportStrategy.WEB_MAGIC_LINK,
    't',
    JWT_SECRET,
  );

  //-- JWT Strategies --//
  jwtChallengeVerifierStrategy(fastifyPassport, repositories.memberRepository);
  refreshTokenStrategy(fastifyPassport, repositories.memberRepository);
  jwtStrategy(fastifyPassport, repositories.memberRepository);
  strictSessionStrategy(fastifyPassport);

  // Register user object to session
  fastifyPassport.registerUserSerializer(async (user: PassportUser, _req) => user.member!.id);
  fastifyPassport.registerUserDeserializer(async (uuid: string, _req): Promise<PassportUser> => {
    return {
      member: await MemberRepository.get(uuid),
    };
  });
};
export default plugin;
