import fastifyPassport from '@fastify/passport';
import { FastifyInstance, FastifyPluginAsync, PassportUser } from 'fastify';

import { AUTH_TOKEN_JWT_SECRET, JWT_SECRET } from '../../../../utils/config';
import { Repositories, buildRepositories } from '../../../../utils/repositories';
import { PassportStrategy } from './strategies';
import magicLinkStrategy from './strategies/magicLink';
import passwordStrategy from './strategies/password';
import passwordResetStrategy from './strategies/passwordReset';

const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const {
    memberPassword: { service: memberPasswordService },
    authentication: { service: authService },
  } = fastify;
  const repositories: Repositories = buildRepositories();
  passwordStrategy(fastifyPassport, memberPasswordService, repositories);
  passwordResetStrategy(fastifyPassport, memberPasswordService);
  magicLinkStrategy(
    fastifyPassport,
    authService,
    repositories,
    PassportStrategy.MOBILE_MAGIC_LINK,
    'token',
    AUTH_TOKEN_JWT_SECRET,
  );
  magicLinkStrategy(
    fastifyPassport,
    authService,
    repositories,
    PassportStrategy.WEB_MAGIC_LINK,
    't',
    JWT_SECRET,
  );

  // Register user object to session
  fastifyPassport.registerUserSerializer(async (user: PassportUser, _req) => user.uuid);
  fastifyPassport.registerUserDeserializer(async (uuid: string, _req) => uuid);
};
export default plugin;
