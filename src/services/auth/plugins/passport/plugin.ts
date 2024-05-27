import fastifyPassport from '@fastify/passport';
import { FastifyInstance, FastifyPluginAsync, PassportUser } from 'fastify';

import { AUTH_TOKEN_JWT_SECRET, JWT_SECRET } from '../../../../utils/config';
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
