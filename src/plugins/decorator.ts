import {  FastifyPluginAsync } from 'fastify';
import { GlobalTaskRunner } from '../services/global-task-runner';
import { ItemService } from '../services/items/db-service';
import { ItemMembershipService } from '../services/item-memberships/db-service';
import { MemberService } from '../services/members/db-service';

 const decoratorPlugin: FastifyPluginAsync = async (fastify) => {
    const { db, log } = fastify;
    fastify.decorate('taskRunner', new GlobalTaskRunner(db, log));
  
    fastify.decorate('members', { dbService: new MemberService(), taskManager: null });
    fastify.decorate('items', { dbService: new ItemService(), taskManager: null });
    fastify.decorate('itemMemberships', { dbService: new ItemMembershipService(), taskManager: null });
  
    fastify.decorateRequest('member', null);
  };
export default decoratorPlugin;
