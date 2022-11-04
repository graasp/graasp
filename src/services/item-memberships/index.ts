import fastifyCors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import { IdParam, PermissionLevel, UnknownExtra } from '@graasp/sdk';

import { WEBSOCKETS_PLUGIN } from '../../util/config';
import { GetItemTask } from '../items/tasks/get-item-task';
import { PurgeBelowParam } from './interfaces/requests';
import common, { create, createMany, deleteAll, deleteOne, getItems, updateOne } from './schemas';
import { TaskManager } from './task-manager';
import { registerItemMembershipWsHooks } from './ws/hooks';
import { ItemMembership } from './entities/ItemMembership';
import { In } from 'typeorm';
import { Member } from '../members/member';
import { Item } from '../items/entities/Item';

const ROUTES_PREFIX = '/item-memberships';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    websockets,
    db,
  } = fastify;
  const itemRepository = db.getRepository(Item);
  const memberRepository = db.getRepository(Member);
  const itemMembershipRepository = db.getRepository(ItemMembership);

  // schemas
  fastify.addSchema(common);

  // routes
  fastify.register(
    async function (fastify) {
      // add CORS support
      if (fastify.corsPluginOptions) {
        fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      // auth plugin session validation
      fastify.addHook('preHandler', fastify.verifyAuthentication);

      // if (WEBSOCKETS_PLUGIN) {
      //   registerItemMembershipWsHooks(
      //     websockets,
      //     runner,
      //     itemsDbService,
      //     dbService,
      //     taskManager,
      //     db.pool,
      //   );
      // }

      // get many item's memberships
      fastify.get<{ Querystring: { itemId: string[] } }>(
        '/',
        { schema: getItems },
        async ({ member, query: { itemId: ids }, log }) => {
         
          return itemMembershipRepository.find({ where: { item: {id:In(ids)} } });
        
        },
      );

      // create item membership
      fastify.post<{ Querystring: { itemId: string }, Body: {permission:PermissionLevel, memberId:string} }>(
        '/',
        { schema: create },
        async ({ member, query: { itemId }, body, log }) => {
     
          const item = await itemRepository.findOneBy({id:itemId});
          const toMember = await memberRepository.findOneBy({id:body.memberId});
          return itemMembershipRepository.create({item, member:toMember, creator:member, permission:body.permission});

        },
      );

      // create many item memberships
      // fastify.post<{
      //   Params: { itemId: string };
      //   Body: { memberships: Partial<ItemMembership>[] };
      // }>('/:itemId', { schema: createMany }, async ({ member, params: { itemId }, body, log }) => {
      //   const checkTasks = taskManager.createGetAdminMembershipTaskSequence(member, itemId);
      //   await runner.runSingleSequence(checkTasks);

      //   const getItemTask = checkTasks[0] as GetItemTask<UnknownExtra>;

      //   const tasks = body.memberships.map((data) =>
      //     taskManager.createCreateSubTaskSequence(member, { data, item: getItemTask.result }),
      //   );
      //   return runner.runMultipleSequences(tasks, log);
      // });

      // update item membership
      fastify.patch<{ Params: IdParam, Body: Partial<ItemMembership> }>(
        '/:id',
        { schema: updateOne },
        async ({ member, params: { id }, body, log }) => {
          await itemMembershipRepository.update(id,body);
          return id;
        },
      );

      // delete item membership
      fastify.delete<{ Params: IdParam; Querystring: PurgeBelowParam }>(
        '/:id',
        { schema: deleteOne },
        async ({ member, params: { id }, query: { purgeBelow }, log }) => {
          // TODO: purge below
          await itemMembershipRepository.delete(id);
return id;
        },
      );

      // delete item's item memberships
      // fastify.delete<{ Querystring: { itemId: string } }>(
      //   '/',
      //   { schema: deleteAll },
      //   async ({ member, query: { itemId }, log }, reply) => {
      //     const tasks = taskManager.createDeleteAllOnAndBelowItemTaskSequence(member, itemId);
      //     await runner.runSingleSequence(tasks, log);
      //     reply.status(204);
      //   },
      // );
    },
    { prefix: ROUTES_PREFIX },
  );
};

export default plugin;
