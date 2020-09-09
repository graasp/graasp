// global
import { FastifyInstance } from 'fastify';
import { IdParam } from 'interfaces/requests';
// local
import common, {
  getItems,
  create,
  updateOne,
  deleteOne
} from './schemas';
import { ItemMembershipTaskManager } from './task-manager';

export default async (fastify: FastifyInstance) => {
  const { db, log, itemService: iS, itemMembershipService: iMS } = fastify;
  const taskManager = new ItemMembershipTaskManager(iS, iMS, db, log);

  // schemas
  fastify.addSchema(common);

  // get item's memberships
  fastify.get<{ Querystring: { itemId: string } }>(
    '/', { schema: getItems },
    async ({ member, query: { itemId } }) => {
      const task = taskManager.createGetItemsItemMembershipsTask(member, itemId);
      return taskManager.run([task]);
    }
  );

  // create item membership
  fastify.post<{ Querystring: { itemId: string } }>(
    '/', { schema: create },
    async ({ member, query: { itemId }, body }) => {
      const task = taskManager.createCreateTask(member, body, itemId);
      return taskManager.run([task]);
    }
  );

  // update item membership
  fastify.patch<{ Params: IdParam }>(
    '/:id', { schema: updateOne },
    async ({ member, params: { id }, body }) => {
      const task = taskManager.createUpdateTask(member, id, body);
      return taskManager.run([task]);
    }
  );

  // delete item membership
  fastify.delete<{ Params: IdParam }>(
    '/:id', { schema: deleteOne },
    async ({ member, params: { id } }) => {
      const task = taskManager.createDeleteTask(member, id);
      return taskManager.run([task]);
    }
  );
};
