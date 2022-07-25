// global
import fastifyCors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';
import graaspApps from 'graasp-apps';
import graaspDocumentItem from 'graasp-document-item';
import graaspEmbeddedLinkItem from 'graasp-embedded-link-item';
import graaspItemFlags from 'graasp-item-flagging';
import graaspItemTags, { ItemTagService } from 'graasp-item-tags';
import {
  ActionHandlerInput,
  ActionService,
  ActionTaskManager,
  BaseAction,
} from 'graasp-plugin-actions';
import graaspCategoryPlugin from 'graasp-plugin-categories';
import graaspChatbox from 'graasp-plugin-chatbox';
import fileItemPlugin from 'graasp-plugin-file-item';
import graaspItemH5P from 'graasp-plugin-h5p';
import graaspHidden from 'graasp-plugin-hidden-items';
import graaspInvitationsPlugin from 'graasp-plugin-invitations';
import graaspPluginItemLikes from 'graasp-plugin-item-likes';
import graaspItemLogin from 'graasp-plugin-item-login';
import graaspItemPublishPlugin from 'graasp-plugin-item-publish';
import graaspItemZip from 'graasp-plugin-item-zip';
import graaspRecycleBin from 'graasp-plugin-recycle-bin';
import thumbnailsPlugin, {
  buildFilePathWithPrefix,
  THUMBNAIL_MIMETYPE,
} from 'graasp-plugin-thumbnails';
import graaspValidationPlugin from 'graasp-plugin-validation';

import { IdParam, IdsParams, ParentIdParam } from '../../interfaces/requests';
import {
  APPS_JWT_SECRET,
  APPS_PLUGIN,
  APPS_PUBLISHER_ID,
  APP_ITEMS_PREFIX,
  AUTH_CLIENT_HOST,
  CHATBOX_PLUGIN,
  CLIENT_HOSTS,
  EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN,
  EMBEDDED_LINK_ITEM_PLUGIN,
  FILES_PATH_PREFIX,
  FILE_ITEM_PLUGIN_OPTIONS,
  GRAASP_ACTOR,
  H5P_CONTENT_PLUGIN_OPTIONS,
  H5P_PATH_PREFIX,
  HIDDEN_TAG_ID,
  IMAGE_CLASSIFIER_API,
  ITEMS_ROUTE_PREFIX,
  LOGIN_ITEM_TAG_ID,
  MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE,
  PROTOCOL,
  PUBLIC_TAG_ID,
  PUBLISHED_TAG_ID,
  S3_FILE_ITEM_PLUGIN_OPTIONS,
  SAVE_ACTIONS,
  SERVICE_METHOD,
  THUMBNAILS_PATH_PREFIX,
  THUMBNAILS_ROUTE_PREFIX,
  WEBSOCKETS_PLUGIN,
} from '../../util/config';
// local
import { PermissionLevel } from '../item-memberships/interfaces/item-membership';
import {
  copyMany,
  copyOne,
  create,
  deleteMany,
  deleteOne,
  getChildren,
  getDescendants,
  getMany,
  getOne,
  getOwn,
  getShared,
  moveMany,
  moveOne,
  updateMany,
  updateOne,
} from './fluent-schema';
import { itemActionHandler } from './handler/item-action-handler';
import { Item } from './interfaces/item';
import { ItemTaskManager } from './interfaces/item-task-manager';
import { Ordered } from './interfaces/requests';
import { TaskManager } from './task-manager';
import { registerItemWsHooks } from './ws/hooks';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    items,
    itemMemberships: { taskManager: membership, dbService: itemMembershipsDbService },
    members: { taskManager: mTM },
    taskRunner: runner,
    websockets,
    db,
  } = fastify;
  const { dbService } = items;
  const taskManager: ItemTaskManager = new TaskManager(dbService, itemMembershipsDbService);
  items.taskManager = taskManager;
  items.extendCreateSchema = create;
  items.extendExtrasUpdateSchema = updateOne;
  const itemTagService = new ItemTagService();

  fastify.decorate('s3FileItemPluginOptions', S3_FILE_ITEM_PLUGIN_OPTIONS);
  fastify.decorate('fileItemPluginOptions', FILE_ITEM_PLUGIN_OPTIONS);

  // deployed w/o the '/items' prefix and w/o auth pre-handler
  if (APPS_PLUGIN) {
    // this needs to execute before 'create()' and 'updateOne()' are called
    // because graaspApps extends the schemas
    await fastify.register(graaspApps, {
      jwtSecret: APPS_JWT_SECRET,
      serviceMethod: SERVICE_METHOD,
      thumbnailsPrefix: THUMBNAILS_PATH_PREFIX,
      prefix: APP_ITEMS_PREFIX,
      publisherId: APPS_PUBLISHER_ID,
    });
  }

  fastify.register(
    async function (fastify) {
      // add CORS support
      if (fastify.corsPluginOptions) {
        fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      // plugins that don't require authentication
      fastify.register(graaspItemLogin, {
        tagId: LOGIN_ITEM_TAG_ID,
        graaspActor: GRAASP_ACTOR,
      });

      fastify.register(graaspInvitationsPlugin, {
        graaspActor: GRAASP_ACTOR,
        buildInvitationLink: (invitation) =>
          `${PROTOCOL}://${AUTH_CLIENT_HOST}/signup?invitationId=${invitation.id}`,
      });

      // core routes - require authentication
      fastify.register(async function (fastify) {
        // auth plugin session validation
        fastify.addHook('preHandler', fastify.verifyAuthentication);

        // H5P plugin must be registered before ZIP
        fastify.register(graaspItemH5P, {
          pathPrefix: H5P_PATH_PREFIX,
          serviceMethod: SERVICE_METHOD,
          serviceOptions: {
            s3: H5P_CONTENT_PLUGIN_OPTIONS,
            local: FILE_ITEM_PLUGIN_OPTIONS,
          },
        });

        fastify.register(graaspItemZip, {
          pathPrefix: FILES_PATH_PREFIX,
          serviceMethod: SERVICE_METHOD,
          serviceOptions: {
            s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
            local: FILE_ITEM_PLUGIN_OPTIONS,
          },
        });

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
          uploadPostHookTasks: async (data, { member }) => {
            const tasks = taskManager.createUpdateTaskSequence(member, data.itemId, {
              settings: { hasThumbnail: Boolean(data.size) },
            });
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

          prefix: THUMBNAILS_ROUTE_PREFIX,
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

        await fastify.register(graaspItemPublishPlugin, {
          publishedTagId: PUBLISHED_TAG_ID,
          publicTagId: PUBLIC_TAG_ID,
          graaspActor: GRAASP_ACTOR,
          hostname: CLIENT_HOSTS.find(({ name }) => name === 'explorer')?.hostname,
        });

        fastify.register(graaspHidden, {
          hiddenTagId: HIDDEN_TAG_ID,
        });

        fastify.register(graaspRecycleBin, {
          recycleItemPostHook: async (itemPath, member, { handler }) =>
            await itemTagService.deleteItemTagsByItemId(
              itemPath,
              [PUBLISHED_TAG_ID, PUBLIC_TAG_ID],
              handler,
            ),
        });

        fastify.register(graaspCategoryPlugin);

        fastify.register(graaspValidationPlugin, {
          // this api needs to be defined from .env
          classifierApi: IMAGE_CLASSIFIER_API,
          serviceMethod: SERVICE_METHOD,
          serviceOptions: {
            s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
            local: FILE_ITEM_PLUGIN_OPTIONS,
          },
        });

        fastify.register(graaspPluginItemLikes);

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

        // isolate the core actions using fastify.register
        fastify.register(async function (fastify) {
          // onResponse hook that executes createAction in graasp-plugin-actions every time there is response
          // it is used to save the actions of the items
          if (SAVE_ACTIONS) {
            const actionService = new ActionService();
            const actionTaskManager = new ActionTaskManager(
              actionService,
              taskManager,
              membership,
              mTM,
              CLIENT_HOSTS,
            );
            fastify.addHook('onResponse', async (request, reply) => {
              // todo: save public actions?
              if (request.member) {
                // wrap the itemActionHandler in a new function to provide it with the properties we already have
                const actionHandler = (actionInput: ActionHandlerInput): Promise<BaseAction[]> =>
                  itemActionHandler(dbService, actionInput);
                const createActionTask = actionTaskManager.createCreateTask(request.member, {
                  request,
                  reply,
                  handler: actionHandler,
                });
                await runner.runSingle(createActionTask);
              }
            });
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
          fastify.get('/own', { schema: getOwn }, async ({ member, log }) => {
            const task = taskManager.createGetOwnTask(member);
            return runner.runSingle(task, log);
          });

          // get shared with
          fastify.get<{ Querystring: { permission?: string[] } }>(
            '/shared-with',
            { schema: getShared },
            async ({ member, log, query }) => {
              const permissions = query?.permission?.filter((p) => Boolean(p));
              const task = taskManager.createGetSharedWithTask(member, { permissions });
              return runner.runSingle(task, log);
            },
          );

          // get item's children
          fastify.get<{ Params: IdParam; Querystring: Ordered }>(
            '/:id/children',
            { schema: getChildren },
            async ({ member, params: { id }, query: { ordered }, log }) => {
              const tasks = taskManager.createGetChildrenTaskSequence(member, id, ordered);
              return runner.runSingleSequence(tasks, log);
            },
          );

          // get item's descendants
          fastify.get<{ Params: IdParam }>(
            '/:id/descendants',
            { schema: getDescendants },
            async ({ member, params: { id }, log }) => {
              const tasks = taskManager.createGetDescendantsTaskSequence(member, id);
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
              const tasks = ids.map((id) =>
                taskManager.createMoveTaskSequence(member, id, parentId),
              );

              // too many items to move: start execution and return '202'.
              if (tasks.length > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE) {
                runner.runMultipleSequences(tasks, log);
                reply.status(202);
                return ids;
              }

              return runner.runMultipleSequences(tasks, log);
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
      });
    },
    { prefix: ITEMS_ROUTE_PREFIX },
  );
};

export default plugin;
