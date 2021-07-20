// global
import { FastifyPluginAsync } from 'fastify';
import graaspFileItem from 'graasp-file-item';
import graaspS3FileItem from 'graasp-s3-file-item';
import graaspEmbeddedLinkItem from 'graasp-embedded-link-item';
import graaspDocumentItem from 'graasp-document-item';
import graaspItemTags from 'graasp-item-tags';
import graaspItemLogin from 'graasp-item-login';
import graaspApps from 'graasp-apps';
import fastifyCors from 'fastify-cors';

import {
  MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE,
  FILE_STORAGE_ROOT_PATH,
  S3_FILE_ITEM_PLUGIN,
  S3_FILE_ITEM_REGION,
  S3_FILE_ITEM_BUCKET,
  S3_FILE_ITEM_ACCESS_KEY_ID,
  S3_FILE_ITEM_SECRET_ACCESS_KEY,
  EMBEDDED_LINK_ITEM_PLUGIN,
  EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN,
  GRAASP_ACTOR,
  APPS_PLUGIN,
  APPS_JWT_SECRET
} from '../../util/config';
import { IdParam, IdsParams, ParentIdParam } from '../../interfaces/requests';
// local
import {
  getOne, getMany,
  getChildren,
  create,
  updateOne, updateMany,
  deleteOne, deleteMany,
  moveOne, moveMany,
  copyOne, copyMany, getOwnGetShared
} from './fluent-schema';
import { TaskManager } from './task-manager';
import { ItemTaskManager } from './interfaces/item-task-manager';
import { Ordered } from './interfaces/requests';

const ROUTES_PREFIX = '/items';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    items,
    itemMemberships: { dbService: itemMembershipsDbService },
    taskRunner: runner
  } = fastify;
  const { dbService } = items;
  const taskManager: ItemTaskManager = new TaskManager(dbService, itemMembershipsDbService);
  items.taskManager = taskManager;
  items.extendCreateSchema = create;
  items.extendExtrasUpdateSchema = updateOne;


  // deployed w/o the '/items' prefix and w/o auth pre-handler
  if (APPS_PLUGIN) {
    // this needs to execute before 'create()' and 'updateOne()' are called
    // because graaspApps extends the schemas
    await fastify.register(graaspApps, { jwtSecret: APPS_JWT_SECRET });
  }

  fastify.register(async function (fastify) {
    // add CORS support
    if (fastify.corsPluginOptions) {
      fastify.register(fastifyCors, fastify.corsPluginOptions);
    }

    // plugins that don't require authentication
    fastify.register(graaspItemLogin, {
      tagId: '6230a72d-59c2-45c2-a8eb-e2a01a3ac05b', // TODO: get from config
      graaspActor: GRAASP_ACTOR
    });

    // core routes - require authentication
    fastify.register(async function (fastify) {

      // auth plugin session validation
      fastify.addHook('preHandler', fastify.verifyAuthentication);

      if (S3_FILE_ITEM_PLUGIN) {
        fastify.register(graaspS3FileItem, {
          s3Region: S3_FILE_ITEM_REGION,
          s3Bucket: S3_FILE_ITEM_BUCKET,
          s3AccessKeyId: S3_FILE_ITEM_ACCESS_KEY_ID,
          s3SecretAccessKey: S3_FILE_ITEM_SECRET_ACCESS_KEY
        });
      } else {
        fastify.register(graaspFileItem, { storageRootPath: FILE_STORAGE_ROOT_PATH });
      }

      if (EMBEDDED_LINK_ITEM_PLUGIN) {
        // 'await' necessary because internally it uses 'extendCreateSchema'
        await fastify.register(graaspEmbeddedLinkItem, {
          iframelyHrefOrigin: EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN
        });
      }

      await fastify.register(graaspDocumentItem);

      fastify.register(graaspItemTags);

      // create item
      fastify.post<{ Querystring: ParentIdParam }>(
        '/', { schema: create() },
        async ({ member, query: { parentId }, body, log }) => {
          const task = taskManager.createCreateTask(member, body, parentId);
          return runner.runSingle(task, log);
        }
      );

      // get item
      fastify.get<{ Params: IdParam }>(
        '/:id', { schema: getOne },
        async ({ member, params: { id }, log }) => {
          const task = taskManager.createGetTask(member, id);
          return runner.runSingle(task, log);
        }
      );

      fastify.get<{ Querystring: IdsParams }>(
        '/', { schema: getMany },
        async ({ member, query: { id: ids }, log }) => {
          const tasks = ids.map(id => taskManager.createGetTask(member, id));
          return runner.runMultiple(tasks, log);
        }
      );

      // get own
      fastify.get(
        '/own', { schema: getOwnGetShared },
        async ({ member, log }) => {
          const task = taskManager.createGetOwnTask(member);
          return runner.runSingle(task, log);
        }
      );

      // get shared with
      fastify.get(
        '/shared-with', { schema: getOwnGetShared },
        async ({ member, log }) => {
          const task = taskManager.createGetSharedWithTask(member);
          return runner.runSingle(task, log);
        }
      );

      // get item's children
      fastify.get<{ Params: IdParam; Querystring: Ordered }>(
        '/:id/children', { schema: getChildren },
        async ({ member, params: { id }, query: { ordered }, log }) => {
          const task = taskManager.createGetChildrenTask(member, id, ordered);
          return runner.runSingle(task, log);
        }
      );

      // update items
      fastify.patch<{ Params: IdParam }>(
        '/:id', { schema: updateOne() },
        async ({ member, params: { id }, body, log }) => {
          const task = taskManager.createUpdateTask(member, id, body);
          return runner.runSingle(task, log);
        }
      );

      fastify.patch<{ Querystring: IdsParams }>(
        '/', { schema: updateMany() },
        async ({ member, query: { id: ids }, body, log }, reply) => {
          const tasks = ids.map(id => taskManager.createUpdateTask(member, id, body));

          // too many items to update: start execution and return '202'.
          if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
            runner.runMultiple(tasks, log);
            reply.status(202);
            return ids;
          }

          return runner.runMultiple(tasks, log);
        }
      );

      // delete items
      fastify.delete<{ Params: IdParam }>(
        '/:id', { schema: deleteOne },
        async ({ member, params: { id }, log }) => {
          const task = taskManager.createDeleteTask(member, id);
          return runner.runSingle(task, log);
        }
      );

      fastify.delete<{ Querystring: IdsParams }>(
        '/', { schema: deleteMany },
        async ({ member, query: { id: ids }, log }, reply) => {
          const tasks = ids.map(id => taskManager.createDeleteTask(member, id));

          // too many items to delete: start execution and return '202'.
          if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
            runner.runMultiple(tasks, log);
            reply.status(202);
            return ids;
          }

          return runner.runMultiple(tasks, log);
        }
      );

      // move items
      fastify.post<{ Params: IdParam; Body: ParentIdParam }>(
        '/:id/move', { schema: moveOne },
        async ({ member, params: { id }, body: { parentId }, log }, reply) => {
          const task = taskManager.createMoveTask(member, id, parentId);
          await runner.runSingle(task, log);
          reply.status(204);
        }
      );

      fastify.post<{ Querystring: IdsParams; Body: ParentIdParam }>(
        '/move', { schema: moveMany },
        async ({ member, query: { id: ids }, body: { parentId }, log }, reply) => {
          const tasks = ids.map(id => taskManager.createMoveTask(member, id, parentId));

          // too many items to move: start execution and return '202'.
          if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
            runner.runMultiple(tasks, log);
            reply.status(202);
            return ids;
          }

          await runner.runMultiple(tasks, log);
          reply.status(204);
        }
      );

      // copy items
      fastify.post<{ Params: IdParam; Body: ParentIdParam }>(
        '/:id/copy', { schema: copyOne },
        async ({ member, params: { id }, body: { parentId }, log }) => {
          const task = taskManager.createCopyTask(member, id, parentId);
          return runner.runSingle(task, log);
        }
      );

      fastify.post<{ Querystring: IdsParams; Body: ParentIdParam }>(
        '/copy', { schema: copyMany },
        async ({ member, query: { id: ids }, body: { parentId }, log }, reply) => {
          const tasks = ids.map(id => taskManager.createCopyTask(member, id, parentId));

          // too many items to copy: start execution and return '202'.
          if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
            runner.runMultiple(tasks, log);
            reply.status(202);
            return ids;
          }

          return runner.runMultiple(tasks, log);
        }
      );

    });
  }, { prefix: ROUTES_PREFIX });
};

export default plugin;
