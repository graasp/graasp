// global
import { FastifyInstance } from 'fastify';
import graaspFileItem from 'graasp-file-item';
import { MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE, FILE_STORAGE_ROOT_PATH } from 'util/config';
import { IdParam, IdsParams, ParentIdParam } from 'interfaces/requests';
// local
import common, {
  getOne,
  getChildren,
  create,
  updateOne, updateMany,
  deleteOne, deleteMany,
  moveOne, moveMany,
  copyOne, copyMany, getOwnAndShared
} from './schemas';
import { ItemTaskManager } from './task-manager';

export default async (fastify: FastifyInstance): Promise<void> => {
  const { db, log, itemService: iS, itemMembershipService: iMS } = fastify;
  const taskManager = new ItemTaskManager(iS, iMS, db, log);

  fastify.decorate('taskManager', taskManager);

  fastify.register(graaspFileItem, { storageRootPath: FILE_STORAGE_ROOT_PATH });

  // schemas
  fastify.addSchema(common);

  // create item
  fastify.post<{ Querystring: ParentIdParam }>(
    '/', { schema: create },
    async ({ member, query: { parentId }, body, log }) => {
      const task = taskManager.createCreateTask(member, body, parentId);
      return taskManager.run([task], log);
    }
  );

  // get item
  fastify.get<{ Params: IdParam }>(
    '/:id', { schema: getOne },
    async ({ member, params: { id }, log }) => {
      const task = taskManager.createGetTask(member, id);
      return taskManager.run([task], log);
    }
  );

  // get own
  fastify.get(
    '/own', { schema: getOwnAndShared },
    async ({ member, log }) => {
      const task = taskManager.createGetOwnTask(member);
      return taskManager.run([task], log);
    }
  );

  // get shared with
  fastify.get(
    '/shared-with', { schema: getOwnAndShared },
    async ({ member, log }) => {
      const task = taskManager.createGetSharedWithTask(member);
      return taskManager.run([task], log);
    }
  );

  // get item's children
  fastify.get<{ Params: IdParam }>(
    '/:id/children', { schema: getChildren },
    async ({ member, params: { id }, log }) => {
      const task = taskManager.createGetChildrenTask(member, id);
      return taskManager.run([task], log);
    }
  );

  // update items
  fastify.patch<{ Params: IdParam }>(
    '/:id', { schema: updateOne },
    async ({ member, params: { id }, body, log }) => {
      const task = taskManager.createUpdateTask(member, id, body);
      return taskManager.run([task], log);
    }
  );

  fastify.patch<{ Querystring: IdsParams }>(
    '/', { schema: updateMany },
    async ({ member, query: { id: ids }, body, log }, reply) => {
      const tasks = ids.map(id => taskManager.createUpdateTask(member, id, body));

      // too many items to update: start execution and return '202'.
      if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
        taskManager.run(tasks, log);
        reply.status(202);
        return ids;
      }

      return taskManager.run(tasks, log);
    }
  );

  // delete items
  fastify.delete<{ Params: IdParam }>(
    '/:id', { schema: deleteOne },
    async ({ member, params: { id }, log }) => {
      const task = taskManager.createDeleteTask(member, id);
      return taskManager.run([task], log);
    }
  );

  fastify.delete<{ Querystring: IdsParams }>(
    '/', { schema: deleteMany },
    async ({ member, query: { id: ids }, log }, reply) => {
      const tasks = ids.map(id => taskManager.createDeleteTask(member, id));

      // too many items to delete: start execution and return '202'.
      if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
        taskManager.run(tasks, log);
        reply.status(202);
        return ids;
      }

      return taskManager.run(tasks, log);
    }
  );

  // move items
  fastify.post<{ Params: IdParam; Body: ParentIdParam }>(
    '/:id/move', { schema: moveOne },
    async ({ member, params: { id }, body: { parentId }, log }, reply) => {
      const task = taskManager.createMoveTask(member, id, parentId);
      await taskManager.run([task], log);
      reply.status(204);
    }
  );

  fastify.post<{ Querystring: IdsParams; Body: ParentIdParam }>(
    '/move', { schema: moveMany },
    async ({ member, query: { id: ids }, body: { parentId }, log }, reply) => {
      const tasks = ids.map(id => taskManager.createMoveTask(member, id, parentId));

      // too many items to move: start execution and return '202'.
      if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
        taskManager.run(tasks, log);
        reply.status(202);
        return ids;
      }

      await taskManager.run(tasks, log);
      reply.status(204);
    }
  );

  // copy items
  fastify.post<{ Params: IdParam; Body: ParentIdParam }>(
    '/:id/copy', { schema: copyOne },
    async ({ member, params: { id }, body: { parentId }, log }, reply) => {
      const task = taskManager.createCopyTask(member, id, parentId);
      await taskManager.run([task], log);
      reply.status(204);
    }
  );

  fastify.post<{ Querystring: IdsParams; Body: ParentIdParam }>(
    '/copy', { schema: copyMany },
    async ({ member, query: { id: ids }, body: { parentId }, log }, reply) => {
      const tasks = ids.map(id => taskManager.createCopyTask(member, id, parentId));

      // too many items to copy: start execution and return '202'.
      if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
        taskManager.run(tasks, log);
        reply.status(202);
        return ids;
      }

      await taskManager.run(tasks, log);
      reply.status(204);
    }
  );
};
