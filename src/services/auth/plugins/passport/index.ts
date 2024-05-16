import fastifyPassport from '@fastify/passport';
import { FastifyInstance, FastifyPluginAsync, PassportUser } from 'fastify';

import { Repositories, buildRepositories } from '../../../../utils/repositories';
import passwordResetStrategy from './strategies/passwordReset';
import webMagicLinkStrategy from './strategies/webMagicLink';
import webPasswordStrategy from './strategies/webPassword';

const plugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const {
    magicLink: { service: magicLinkService },
    memberPassword: { service: memberPasswordService },
  } = fastify;
  const repositories: Repositories = buildRepositories();
  passwordResetStrategy(fastifyPassport, memberPasswordService);
  webMagicLinkStrategy(fastifyPassport, magicLinkService, repositories);
  webPasswordStrategy(fastifyPassport, memberPasswordService, repositories);

  // Register user object to session
  fastifyPassport.registerUserSerializer(async (user: PassportUser, _req) => user.uuid);
  fastifyPassport.registerUserDeserializer(async (uuid: string, _req) => uuid);
};
export default plugin;
