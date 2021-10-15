
  import { FastifyPluginAsync } from 'fastify';
  import { AuthPluginOptions } from '../interfaces/auth';
  
  const plugin: FastifyPluginAsync<AuthPluginOptions> = async (
      fastify,
    ) => {
      const {log} = fastify;
      await fastify.decorate('validateSession', async () => {
        log.debug('validateSession');
      });
      await fastify.decorate('attemptVerifyAuthentication', async () => {
        log.debug('attemptVerifyAuthentication');
      });
      await fastify.decorate('verifyAuthentication', async () => {
        log.debug('verifyAuthentication');
      });
      await fastify.decorate('generateAuthTokensPair', async () => {
        log.debug('generateAuthTokensPair');
      });
    };
  
    export default plugin;
  