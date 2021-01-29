// global
import { FastifyPluginAsync } from 'fastify';
import graaspFileItem from 'graasp-file-item';
import graaspS3FileItem from 'graasp-s3-file-item';
import graaspItemTags from 'graasp-item-tags';
import {
  MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE,
  FILE_STORAGE_ROOT_PATH,
  S3_FILE_ITEM_PLUGIN,
  S3_FILE_ITEM_REGION,
  S3_FILE_ITEM_BUCKET,
  S3_FILE_ITEM_ACCESS_KEY_ID,
  S3_FILE_ITEM_SECRET_ACCESS_KEY,
} from '../../util/config';
import { IdParam, IdsParams, ParentIdParam } from '../../interfaces/requests';
// local
import common, {
  getOne, getMany,
  getChildren,
  create,
  updateOne, updateMany,
  deleteOne, deleteMany,
  moveOne, moveMany,
  copyOne, copyMany, getOwnAndShared
} from './schemas';
import { ItemTaskManager } from './task-manager';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { itemService: iS, itemMembershipService: iMS, taskRunner: runner } = fastify;
  const taskManager = new ItemTaskManager(iS, iMS);

  // TODO: add plugins after migrating them
  fastify.register(graaspFileItem, {
    storageRootPath: FILE_STORAGE_ROOT_PATH,
    itemTaskManager: taskManager
  });
  if (S3_FILE_ITEM_PLUGIN) {
    fastify.register(graaspS3FileItem, {
      s3Region: S3_FILE_ITEM_REGION,
      s3Bucket: S3_FILE_ITEM_BUCKET,
      s3AccessKeyId: S3_FILE_ITEM_ACCESS_KEY_ID,
      s3SecretAccessKey: S3_FILE_ITEM_SECRET_ACCESS_KEY,
      itemTaskManager: taskManager
    });
  }

  // schemas
  fastify.addSchema(common);

  fastify.register(graaspItemTags);

  // create item
  fastify.post<{ Querystring: ParentIdParam }>(
    '/', { schema: create },
    async ({ member, query: { parentId }, body, log }) => {
      const task = taskManager.createCreateTask(member, body, parentId);
      return runner.run([task], log);
    }
  );

  // get item
  fastify.get<{ Params: IdParam }>(
    '/:id', { schema: getOne },
    async ({ member, params: { id }, log }) => {
      const task = taskManager.createGetTask(member, id);
      return runner.run([task], log);
    }
  );

  fastify.get<{ Querystring: IdsParams }>(
    '/', { schema: getMany },
    async ({ member, query: { id: ids }, log }) => {
      const tasks = ids.map(id => taskManager.createGetTask(member, id));
      return runner.run(tasks, log);
    }
  );

  // get own
  fastify.get(
    '/own', { schema: getOwnAndShared },
    async ({ member, log }) => {
      const task = taskManager.createGetOwnTask(member);
      return runner.run([task], log);
    }
  );

  // get shared with
  fastify.get(
    '/shared-with', { schema: getOwnAndShared },
    async ({ member, log }) => {
      const task = taskManager.createGetSharedWithTask(member);
      return runner.run([task], log);
    }
  );

  // get item's children
  fastify.get<{ Params: IdParam }>(
    '/:id/children', { schema: getChildren },
    async ({ member, params: { id }, log }) => {
      const task = taskManager.createGetChildrenTask(member, id);
      return runner.run([task], log);
    }
  );

  // update items
  fastify.patch<{ Params: IdParam }>(
    '/:id', { schema: updateOne },
    async ({ member, params: { id }, body, log }) => {
      const task = taskManager.createUpdateTask(member, id, body);
      return runner.run([task], log);
    }
  );

  fastify.patch<{ Querystring: IdsParams }>(
    '/', { schema: updateMany },
    async ({ member, query: { id: ids }, body, log }, reply) => {
      const tasks = ids.map(id => taskManager.createUpdateTask(member, id, body));

      // too many items to update: start execution and return '202'.
      if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
        runner.run(tasks, log);
        reply.status(202);
        return ids;
      }

      return runner.run(tasks, log);
    }
  );

  // delete items
  fastify.delete<{ Params: IdParam }>(
    '/:id', { schema: deleteOne },
    async ({ member, params: { id }, log }) => {
      const task = taskManager.createDeleteTask(member, id);
      return runner.run([task], log);
    }
  );

  fastify.delete<{ Querystring: IdsParams }>(
    '/', { schema: deleteMany },
    async ({ member, query: { id: ids }, log }, reply) => {
      const tasks = ids.map(id => taskManager.createDeleteTask(member, id));

      // too many items to delete: start execution and return '202'.
      if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
        runner.run(tasks, log);
        reply.status(202);
        return ids;
      }

      return runner.run(tasks, log);
    }
  );

  // move items
  fastify.post<{ Params: IdParam; Body: ParentIdParam }>(
    '/:id/move', { schema: moveOne },
    async ({ member, params: { id }, body: { parentId }, log }, reply) => {
      const task = taskManager.createMoveTask(member, id, parentId);
      await runner.run([task], log);
      reply.status(204);
    }
  );

  fastify.post<{ Querystring: IdsParams; Body: ParentIdParam }>(
    '/move', { schema: moveMany },
    async ({ member, query: { id: ids }, body: { parentId }, log }, reply) => {
      const tasks = ids.map(id => taskManager.createMoveTask(member, id, parentId));

      // too many items to move: start execution and return '202'.
      if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
        runner.run(tasks, log);
        reply.status(202);
        return ids;
      }

      await runner.run(tasks, log);
      reply.status(204);
    }
  );

  // copy items
  fastify.post<{ Params: IdParam; Body: ParentIdParam }>(
    '/:id/copy', { schema: copyOne },
    async ({ member, params: { id }, body: { parentId }, log }) => {
      const task = taskManager.createCopyTask(member, id, parentId);
      return runner.run([task], log);
    }
  );

  fastify.post<{ Querystring: IdsParams; Body: ParentIdParam }>(
    '/copy', { schema: copyMany },
    async ({ member, query: { id: ids }, body: { parentId }, log }, reply) => {
      const tasks = ids.map(id => taskManager.createCopyTask(member, id, parentId));

      // too many items to copy: start execution and return '202'.
      if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
        runner.run(tasks, log);
        reply.status(202);
        return ids;
      }

      return runner.run(tasks, log);
    }
  );
};

export default plugin;
