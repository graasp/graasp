import { FastifyPluginAsync } from 'fastify';

import ItemService from '../services/item/service';
import { MemberService } from '../services/member/service';

const decoratorPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('member', null);

  fastify.decorate('members', { service: new MemberService() });

  fastify.decorate('items', {
    service: new ItemService(),
  });
};
export default decoratorPlugin;
