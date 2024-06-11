import { FastifyPluginAsync } from 'fastify';

import { resolveDependency } from '../dependencies';
import { JobService } from '../jobs';
import { SearchService } from '../services/item/plugins/published/plugins/search/service';

const decoratorPlugin: FastifyPluginAsync = async (fastify) => {
  /**
   * This is done for performance reasons:
   * 1. First decorateRequest with the empty type of the value to be set (null for an object)
   *    BUT NEVER SET THE ACTUAL OBJECT IN decorateRequest FOR SECURITY (reference is shared)
   * 2. Then later use a hook such as preHandler or onRequest to store the actual value
   *    (it will be properly encapsulated)
   * @example
   *  fastify.decorateRequest('user', null) // <-- must use null here if user will be an object
   *  // later in the code
   *  fastify.addHook('preHandler', (request) => {
   *     request.user = { name: 'John Doe' } // <-- must set the actual object here
   *  })
   * @see
   *  https://www.fastify.io/docs/latest/Reference/Decorators/#decoraterequestname-value-dependencies
   *  https://www.fastify.io/docs/latest/Reference/Decorators/
   */
  fastify.decorateRequest('member', null);

  // Launch Job workers
  fastify.decorate('jobs', {
    service: new JobService(resolveDependency(SearchService), fastify.log),
  });
};
export default decoratorPlugin;
