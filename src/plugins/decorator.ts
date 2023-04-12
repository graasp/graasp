import { FastifyPluginAsync } from 'fastify';

import { ActionService } from '../services/action/services/action';
import ItemService from '../services/item/service';
import { MemberService } from '../services/member/service';

const decoratorPlugin: FastifyPluginAsync = async (fastify) => {
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
