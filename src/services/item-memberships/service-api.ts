// global
import { FastifyPluginAsync } from 'fastify';
import fastifyCors from '@fastify/cors';
import { IdParam } from '../../interfaces/requests';
// local
import common, { getItems, create, updateOne, deleteOne, deleteAll, createMany } from './schemas';
import { PurgeBelowParam } from './interfaces/requests';
import { ItemMembershipTaskManager } from './interfaces/item-membership-task-manager';
import { TaskManager } from './task-manager';
import { WEBSOCKETS_PLUGIN } from '../../util/config';
import { registerItemMembershipWsHooks } from './ws/hooks';
import { ItemMembership } from './interfaces/item-membership';

const ROUTES_PREFIX = '/item-memberships';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    items: { dbService: itemsDbService },
    itemMemberships,
    taskRunner: runner,
    websockets,
    db,
    members: { dbService: membersDbService },
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
      fastify.post<{ Params: { itemId: string }; Body: { memberships: ItemMembership[] } }>(
        '/:itemId',
        { schema: createMany },
        async ({ member, params: { itemId }, body, log }) => {
          // todo: optimize
          const tasks = body.memberships.map((m) =>
            taskManager.createCreateTaskSequence(member, m, itemId),
          );
          return runner.runMultipleSequences(tasks, log);
        },
      );

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
