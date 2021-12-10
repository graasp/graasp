// global
import { FastifyPluginAsync } from 'fastify';
import graaspEmbeddedLinkItem from 'graasp-embedded-link-item';
import graaspDocumentItem from 'graasp-document-item';
import graaspItemTags from 'graasp-item-tags';
import graaspItemFlags from 'graasp-item-flagging';
import graaspItemLogin from 'graasp-plugin-item-login';
import graaspCategoryPlugins from 'graasp-plugin-categories';
import graaspApps from 'graasp-apps';
import graaspRecycleBin from 'graasp-plugin-recycle-bin';
import fastifyCors from 'fastify-cors';
import graaspChatbox from 'graasp-plugin-chatbox';
import fileItemPlugin from 'graasp-plugin-file-item';
import thumbnailsPlugin, {
  buildFilePathWithPrefix,
  THUMBNAIL_MIMETYPE,
} from 'graasp-plugin-thumbnails';

import {
  MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE,
  EMBEDDED_LINK_ITEM_PLUGIN,
  EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN,
  GRAASP_ACTOR,
  APPS_PLUGIN,
  APPS_JWT_SECRET,
  CHATBOX_PLUGIN,
  WEBSOCKETS_PLUGIN,
  S3_FILE_ITEM_PLUGIN_OPTIONS,
  FILES_PATH_PREFIX,
  FILE_ITEM_PLUGIN_OPTIONS,
  SERVICE_METHOD,
  THUMBNAILS_PATH_PREFIX,
} from '../../util/config';
import { IdParam, IdsParams, ParentIdParam } from '../../interfaces/requests';
// local
import {
  getOne,
  getMany,
  getChildren,
  create,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
  moveOne,
  moveMany,
  copyOne,
  copyMany,
  getOwnGetShared,
} from './fluent-schema';
import { TaskManager } from './task-manager';
import { ItemTaskManager } from './interfaces/item-task-manager';
import { Ordered } from './interfaces/requests';
import { registerItemWsHooks } from './ws/hooks';
import { PermissionLevel } from '../item-memberships/interfaces/item-membership';
import { Item } from './interfaces/item';

const ROUTES_PREFIX = '/items';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    items,
    itemMemberships: { taskManager: membership, dbService: itemMembershipsDbService },
    taskRunner: runner,
    websockets,
    db,
  } = fastify;
  const { dbService } = items;
  const taskManager: ItemTaskManager = new TaskManager(dbService, itemMembershipsDbService);
  items.taskManager = taskManager;
  items.extendCreateSchema = create;
  items.extendExtrasUpdateSchema = updateOne;

  fastify.decorate('s3FileItemPluginOptions', S3_FILE_ITEM_PLUGIN_OPTIONS);
  fastify.decorate('fileItemPluginOptions', FILE_ITEM_PLUGIN_OPTIONS);

  // deployed w/o the '/items' prefix and w/o auth pre-handler
  if (APPS_PLUGIN) {
    // this needs to execute before 'create()' and 'updateOne()' are called
    // because graaspApps extends the schemas
    await fastify.register(graaspApps, { jwtSecret: APPS_JWT_SECRET, serviceMethod: SERVICE_METHOD, thumbnailsPrefix: THUMBNAILS_PATH_PREFIX });
  }

  fastify.register(
    async function (fastify) {
      // add CORS support
      if (fastify.corsPluginOptions) {
        fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      // plugins that don't require authentication
      fastify.register(graaspItemLogin, {
        tagId: '6230a72d-59c2-45c2-a8eb-e2a01a3ac05b', // TODO: get from config
        graaspActor: GRAASP_ACTOR,
      });

      // core routes - require authentication
      fastify.register(async function (fastify) {
        // auth plugin session validation
        fastify.addHook('preHandler', fastify.verifyAuthentication);

        fastify.register(thumbnailsPlugin, {
          serviceMethod: SERVICE_METHOD,
          serviceOptions: {
            s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
            local: FILE_ITEM_PLUGIN_OPTIONS,
          },
          pathPrefix: THUMBNAILS_PATH_PREFIX,
          enableItemsHooks: true,
          uploadPreHookTasks: async (id, { member }) => {
            const tasks = membership.createGetOfItemTaskSequence(member, id.parentId);
            tasks[1].input = { validatePermission: PermissionLevel.Write };
            return tasks;
          },
          downloadPreHookTasks: async ({ itemId: id, filename }, { member }) => {
            const tasks = membership.createGetOfItemTaskSequence(member, id);
            tasks[1].input = { validatePermission: PermissionLevel.Read };
            const last = tasks[tasks.length - 1];
            last.getResult = () => ({
              filepath: buildFilePathWithPrefix({
                itemId: (tasks[0].result as Item).id,
                pathPrefix: THUMBNAILS_PATH_PREFIX,
                filename,
              }),
              mimetype: THUMBNAIL_MIMETYPE,
            });
            return tasks;
          },

          prefix: '/thumbnails',
        });

        fastify.register(fileItemPlugin, {
          shouldLimit: true,
          pathPrefix: FILES_PATH_PREFIX,
          serviceMethod: SERVICE_METHOD,
          serviceOptions: {
            s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
            local: FILE_ITEM_PLUGIN_OPTIONS,
          },
        });

        if (EMBEDDED_LINK_ITEM_PLUGIN) {
          // 'await' necessary because internally it uses 'extendCreateSchema'
          await fastify.register(graaspEmbeddedLinkItem, {
            iframelyHrefOrigin: EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN,
          });
        }

        await fastify.register(graaspDocumentItem);

        fastify.register(graaspItemFlags);

        fastify.register(graaspItemTags);

        fastify.register(graaspRecycleBin);

        fastify.register(graaspCategoryPlugins);

        if (CHATBOX_PLUGIN) {
          fastify.register(graaspChatbox);
        }

        if (WEBSOCKETS_PLUGIN) {
          registerItemWsHooks(
            websockets,
            runner,
            dbService,
            itemMembershipsDbService,
            taskManager,
            db.pool,
          );
        }

        // create item
        fastify.post<{ Querystring: ParentIdParam }>(
          '/',
          { schema: create() },
          async ({ member, query: { parentId }, body: data, log }) => {
            const tasks = taskManager.createCreateTaskSequence(member, data, parentId);
            return runner.runSingleSequence(tasks, log);
          },
        );

        // get item
        fastify.get<{ Params: IdParam }>(
          '/:id',
          { schema: getOne },
          async ({ member, params: { id }, log }) => {
            const tasks = taskManager.createGetTaskSequence(member, id);
            return runner.runSingleSequence(tasks, log);
          },
        );

        fastify.get<{ Querystring: IdsParams }>(
          '/',
          { schema: getMany },
          async ({ member, query: { id: ids }, log }) => {
            const tasks = ids.map((id) => taskManager.createGetTaskSequence(member, id));
            return runner.runMultipleSequences(tasks, log);
          },
        );

        // get own
        fastify.get('/own', { schema: getOwnGetShared }, async ({ member, log }) => {
          const task = taskManager.createGetOwnTask(member);
          return runner.runSingle(task, log);
        });

        // get shared with
        fastify.get('/shared-with', { schema: getOwnGetShared }, async ({ member, log }) => {
          const task = taskManager.createGetSharedWithTask(member);
          return runner.runSingle(task, log);
        });

        // get item's children
        fastify.get<{ Params: IdParam; Querystring: Ordered }>(
          '/:id/children',
          { schema: getChildren },
          async ({ member, params: { id }, query: { ordered }, log }) => {
            const tasks = taskManager.createGetChildrenTaskSequence(member, id, ordered);
            return runner.runSingleSequence(tasks, log);
          },
        );

        // update items
        fastify.patch<{ Params: IdParam }>(
          '/:id',
          { schema: updateOne() },
          async ({ member, params: { id }, body, log }) => {
            const tasks = taskManager.createUpdateTaskSequence(member, id, body);
            return runner.runSingleSequence(tasks, log);
          },
        );

        fastify.patch<{ Querystring: IdsParams }>(
          '/',
          { schema: updateMany() },
          async ({ member, query: { id: ids }, body, log }, reply) => {
            const tasks = ids.map((id) => taskManager.createUpdateTaskSequence(member, id, body));

            // too many items to update: start execution and return '202'.
            if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
              runner.runMultipleSequences(tasks, log);
              reply.status(202);
              return ids;
            }

            return runner.runMultipleSequences(tasks, log);
          },
        );

        // delete items
        fastify.delete<{ Params: IdParam }>(
          '/:id',
          { schema: deleteOne },
          async ({ member, params: { id }, log }) => {
            const tasks = taskManager.createDeleteTaskSequence(member, id);
            return runner.runSingleSequence(tasks, log);
          },
        );

        fastify.delete<{ Querystring: IdsParams }>(
          '/',
          { schema: deleteMany },
          async ({ member, query: { id: ids }, log }, reply) => {
            const tasks = ids.map((id) => taskManager.createDeleteTaskSequence(member, id));

            // too many items to delete: start execution and return '202'.
            if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
              runner.runMultipleSequences(tasks, log);
              reply.status(202);
              return ids;
            }

            return runner.runMultipleSequences(tasks, log);
          },
        );

        // move items
        fastify.post<{ Params: IdParam; Body: ParentIdParam }>(
          '/:id/move',
          { schema: moveOne },
          async ({ member, params: { id }, body: { parentId }, log }, reply) => {
            const task = taskManager.createMoveTaskSequence(member, id, parentId);
            await runner.runSingleSequence(task, log);
            reply.status(204);
          },
        );

        fastify.post<{ Querystring: IdsParams; Body: ParentIdParam }>(
          '/move',
          { schema: moveMany },
          async ({ member, query: { id: ids }, body: { parentId }, log }, reply) => {
            const tasks = ids.map((id) => taskManager.createMoveTaskSequence(member, id, parentId));

            // too many items to move: start execution and return '202'.
            if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
              runner.runMultipleSequences(tasks, log);
              reply.status(202);
              return ids;
            }

            await runner.runMultipleSequences(tasks, log);
            reply.status(204);
          },
        );

        // copy items
        fastify.post<{ Params: IdParam; Body: { parentId: string; shouldCopyTags?: boolean } }>(
          '/:id/copy',
          { schema: copyOne },
          async ({ member, params: { id }, body: { parentId, shouldCopyTags }, log }) => {
            const tasks = taskManager.createCopyTaskSequence(member, id, {
              parentId,
              shouldCopyTags,
            });
            return runner.runSingleSequence(tasks, log);
          },
        );

        fastify.post<{
          Querystring: IdsParams;
          Body: { parentId: string; shouldCopyTags?: boolean };
        }>(
          '/copy',
          { schema: copyMany },
          async (
            { member, query: { id: ids }, body: { parentId, shouldCopyTags }, log },
            reply,
          ) => {
            const tasks = ids.map((id) =>
              taskManager.createCopyTaskSequence(member, id, { parentId, shouldCopyTags }),
            );

            // too many items to copy: start execution and return '202'.
            if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
              runner.runMultipleSequences(tasks, log);
              reply.status(202);
              return ids;
            }

            return runner.runMultipleSequences(tasks, log);
          },
        );
      });
    },
    { prefix: ROUTES_PREFIX },
  );
};

export default plugin;
