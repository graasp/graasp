import { FastifyPluginAsync } from 'fastify';

import { ActionService } from '../services/action/services/action';
import ItemService from '../services/item/service';
import { MemberService } from '../services/member/service';

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

  fastify.decorate('members', { service: new MemberService() });

  fastify.decorate('items', {
    service: new ItemService(),
  });

  fastify.decorate('actions', {
    service: new ActionService(fastify.items.service, fastify.members.service, fastify.hosts),
  });
};
export default decoratorPlugin;
