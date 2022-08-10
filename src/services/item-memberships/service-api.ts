import fastifyCors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import {
  ActionType,
  Context,
  IdParam,
  ItemMembership,
  ItemMembershipTaskManager,
  Member,
  UnknownExtra,
} from '@graasp/sdk';

import { SAVE_ACTIONS, WEBSOCKETS_PLUGIN } from '../../util/config';
import { GetItemTask } from '../items/tasks/get-item-task';
import { itemMembershipActionBuilder } from './handler/item-membership-action-builder';
import { PurgeBelowParam } from './interfaces/requests';
import common, { create, createMany, deleteAll, deleteOne, getItems, updateOne } from './schemas';
import { TaskManager } from './task-manager';
import { registerItemMembershipWsHooks } from './ws/hooks';

const ROUTES_PREFIX = '/item-memberships';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    items: { dbService: itemsDbService },
    itemMemberships,
    taskRunner: runner,
    websockets,
    db,
    members: { dbService: membersDbService },
    actions: { taskManager: actionTaskManager, dbService: actionService },
  } = fastify;
  const { dbService } = itemMemberships;
  const taskManager: ItemMembershipTaskManager = new TaskManager(
    itemsDbService,
    dbService,
    membersDbService,
  );
  itemMemberships.taskManager = taskManager;

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

      if (WEBSOCKETS_PLUGIN) {
        registerItemMembershipWsHooks(
          websockets,
          runner,
          itemsDbService,
          dbService,
          taskManager,
          db.pool,
        );
      }

      // onResponse hook that executes createAction in graasp-plugin-actions every time there is response
      // it is used to save the actions of the items
      if (SAVE_ACTIONS) {
        fastify.addHook('onSend', async (request, reply, payload) => {
          // todo: save public actions?
          if (request.member) {
            const createActionTask = actionTaskManager.createCreateTask(request.member, {
              request,
              reply,
              actionBuilder: itemMembershipActionBuilder({ payload, itemService: itemsDbService }),
            });
            await runner.runSingle(createActionTask);
          }
          return payload;
        });
      }

      // get many item's memberships
      fastify.get<{ Querystring: { itemId: string[] } }>(
        '/',
        { schema: getItems },
        async ({ member, query: { itemId: ids }, log }) => {
          const tasks = ids.map((id) => taskManager.createGetOfItemTaskSequence(member, id));
          return runner.runMultipleSequences(tasks, log);
        },
      );

      // create item membership
      fastify.post<{ Querystring: { itemId: string } }>(
        '/',
        { schema: create },
        async ({ member, query: { itemId }, body, log }) => {
          const tasks = taskManager.createCreateTaskSequence(member, body, itemId);
          return runner.runSingleSequence(tasks, log);
        },
      );

      // create many item memberships
      fastify.post<{
        Params: { itemId: string };
        Body: { memberships: Partial<ItemMembership>[] };
      }>('/:itemId', { schema: createMany }, async ({ member, params: { itemId }, body, log }) => {
        const checkTasks = taskManager.createGetAdminMembershipTaskSequence(member, itemId);
        await runner.runSingleSequence(checkTasks);

        const getItemTask = checkTasks[0] as GetItemTask<UnknownExtra>;

        const tasks = body.memberships.map((data) =>
          taskManager.createCreateSubTaskSequence(member, { data, item: getItemTask.result }),
        );
        return runner.runMultipleSequences(tasks, log);
      });

      // update item membership
      fastify.patch<{ Params: IdParam }>(
        '/:id',
        { schema: updateOne },
        async ({ member, params: { id }, body, log }) => {
          const tasks = taskManager.createUpdateTaskSequence(member, id, body);
          return runner.runSingleSequence(tasks, log);
        },
      );

      // delete item membership
      fastify.delete<{ Params: IdParam; Querystring: PurgeBelowParam }>(
        '/:id',
        { schema: deleteOne },
        async ({ member, params: { id }, query: { purgeBelow }, log }) => {
          const tasks = taskManager.createDeleteTaskSequence(member, id, purgeBelow);
          return runner.runSingleSequence(tasks, log);
        },
      );

      // delete item's item memberships
      fastify.delete<{ Querystring: { itemId: string } }>(
        '/',
        { schema: deleteAll },
        async ({ member, query: { itemId }, log }, reply) => {
          const tasks = taskManager.createDeleteAllOnAndBelowItemTaskSequence(member, itemId);
          await runner.runSingleSequence(tasks, log);
          reply.status(204);
        },
      );
    },
    { prefix: ROUTES_PREFIX },
  );
};

export default plugin;
