import { FastifyPluginAsync } from 'fastify';

import { ACTOR } from '../../../test/fixtures/members';

const mockedDecoratorPlugin: FastifyPluginAsync = async (fastify) => {

  // necessary to set a valid member when the auth plugin is mocked
  fastify.decorateRequest('member', ACTOR);
};
export default mockedDecoratorPlugin;
