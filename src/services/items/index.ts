import fastifyCors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import {
  IdParam,
  IdsParams,
  Item,
  ItemTaskManager,
  MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE,
  ParentIdParam,
  PermissionLevel,
} from '@graasp/sdk';
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
  THUMBNAIL_MIMETYPE,
  buildFilePathWithPrefix,
} from 'graasp-plugin-thumbnails';
import graaspValidationPlugin from 'graasp-plugin-validation';

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
  FILE_ITEM_TYPE,
  GRAASP_ACTOR,
  H5P_CONTENT_PLUGIN_OPTIONS,
  H5P_PATH_PREFIX,
  HIDDEN_ITEMS_PLUGIN,
  HIDDEN_TAG_ID,
  IMAGE_CLASSIFIER_API,
  ITEMS_ROUTE_PREFIX,
  LOGIN_ITEM_TAG_ID,
  PROTOCOL,
  PUBLIC_TAG_ID,
  PUBLISHED_TAG_ID,
  S3_FILE_ITEM_PLUGIN_OPTIONS,
  SAVE_ACTIONS,
  THUMBNAILS_PATH_PREFIX,
  THUMBNAILS_ROUTE_PREFIX,
  WEBSOCKETS_PLUGIN,
} from '../../util/config';
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
import { Ordered } from './interfaces/requests';
import { TaskManager } from './task-manager';
import { registerItemWsHooks } from './ws/hooks';

import itemController from './itemController';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    websockets,
    db,
  } = fastify;
  // const { dbService } = items;
  // const taskManager: ItemTaskManager = new TaskManager(dbService, itemMembershipsDbService);
  // items.taskManager = taskManager;
  // items.extendCreateSchema = create;
  // items.extendExtrasUpdateSchema = updateOne;
  const itemTagService = new ItemTagService();

  fastify.decorate('file', {
    s3Config: S3_FILE_ITEM_PLUGIN_OPTIONS,
    localConfig: FILE_ITEM_PLUGIN_OPTIONS,
  });

  // deployed w/o the '/items' prefix and w/o auth pre-handler
  // if (APPS_PLUGIN) {
  //   // this needs to execute before 'create()' and 'updateOne()' are called
  //   // because graaspApps extends the schemas
  //   await fastify.register(graaspApps, {
  //     jwtSecret: APPS_JWT_SECRET,
  //     fileItemType: FILE_ITEM_TYPE,
  //     thumbnailsPrefix: THUMBNAILS_PATH_PREFIX,
  //     prefix: APP_ITEMS_PREFIX,
  //     publisherId: APPS_PUBLISHER_ID,
  //   });
  // }

  fastify.register(
    async function (fastify) {
      // add CORS support
      // if (fastify.corsPluginOptions) {
      //   fastify.register(fastifyCors, fastify.corsPluginOptions);
      // }

      // // plugins that don't require authentication
      // fastify.register(graaspItemLogin, {
      //   tagId: LOGIN_ITEM_TAG_ID,
      //   graaspActor: GRAASP_ACTOR,
      // });

      // fastify.register(graaspInvitationsPlugin, {
      //   graaspActor: GRAASP_ACTOR,
      //   buildInvitationLink: (invitation) =>
      //     `${PROTOCOL}://${AUTH_CLIENT_HOST}/signup?invitationId=${invitation.id}`,
      // });

      // core routes - require authentication
      fastify.register(async function (fastify) {
        // auth plugin session validation
        fastify.addHook('preHandler', fastify.verifyAuthentication);

        // // H5P plugin must be registered before ZIP
        // fastify.register(graaspItemH5P, {
        //   pathPrefix: H5P_PATH_PREFIX,
        //   fileItemType: FILE_ITEM_TYPE,
        //   fileConfigurations: {
        //     s3: H5P_CONTENT_PLUGIN_OPTIONS,
        //     local: FILE_ITEM_PLUGIN_OPTIONS,
        //   },
        // });

        // fastify.register(graaspItemZip, {
        //   pathPrefix: FILES_PATH_PREFIX,
        //   fileItemType: FILE_ITEM_TYPE,
        //   fileConfigurations: {
        //     s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
        //     local: FILE_ITEM_PLUGIN_OPTIONS,
        //   },
        // });

        // fastify.register(thumbnailsPlugin, {
        //   fileItemType: FILE_ITEM_TYPE,
        //   fileConfigurations: {
        //     s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
        //     local: FILE_ITEM_PLUGIN_OPTIONS,
        //   },
        //   pathPrefix: THUMBNAILS_PATH_PREFIX,
        //   enableItemsHooks: true,
        //   uploadPreHookTasks: async (id, { member }) => {
        //     const tasks = membership.createGetOfItemTaskSequence(member, id.parentId);
        //     tasks[1].input = { validatePermission: PermissionLevel.Write };
        //     return tasks;
        //   },
        //   uploadPostHookTasks: async (data, { member }) => {
        //     const tasks = taskManager.createUpdateTaskSequence(member, data.itemId, {
        //       settings: { hasThumbnail: Boolean(data.size) },
        //     });
        //     return tasks;
        //   },

        //   downloadPreHookTasks: async ({ itemId: id, filename }, { member }) => {
        //     const tasks = membership.createGetOfItemTaskSequence(member, id);
        //     tasks[1].input = { validatePermission: PermissionLevel.Read };
        //     const last = tasks[tasks.length - 1];
        //     last.getResult = () => ({
        //       filepath: buildFilePathWithPrefix({
        //         itemId: (tasks[0].result as Item).id,
        //         pathPrefix: THUMBNAILS_PATH_PREFIX,
        //         filename,
        //       }),
        //       mimetype: THUMBNAIL_MIMETYPE,
        //     });
        //     return tasks;
        //   },

        //   prefix: THUMBNAILS_ROUTE_PREFIX,
        // });

        // fastify.register(fileItemPlugin, {
        //   shouldLimit: true,
        //   pathPrefix: FILES_PATH_PREFIX,
        //   fileItemType: FILE_ITEM_TYPE,
        //   fileConfigurations: {
        //     s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
        //     local: FILE_ITEM_PLUGIN_OPTIONS,
        //   },
        // });

        // if (EMBEDDED_LINK_ITEM_PLUGIN) {
        //   // 'await' necessary because internally it uses 'extendCreateSchema'
        //   await fastify.register(graaspEmbeddedLinkItem, {
        //     iframelyHrefOrigin: EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN,
        //   });
        // }

        // await fastify.register(graaspDocumentItem);

        // fastify.register(graaspItemFlags);

        // fastify.register(graaspItemTags);

        // await fastify.register(graaspItemPublishPlugin, {
        //   publishedTagId: PUBLISHED_TAG_ID,
        //   publicTagId: PUBLIC_TAG_ID,
        //   graaspActor: GRAASP_ACTOR,
        //   hostname: CLIENT_HOSTS.find(({ name }) => name === 'explorer')?.hostname,
        // });

        // if (HIDDEN_ITEMS_PLUGIN) {
        //   fastify.register(graaspHidden, {
        //     hiddenTagId: HIDDEN_TAG_ID,
        //   });
        // }

        // fastify.register(graaspRecycleBin, {
        //   recycleItemPostHook: async (itemPath, member, { handler }) =>
        //     await itemTagService.deleteItemTagsByItemId(
        //       itemPath,
        //       [PUBLISHED_TAG_ID, PUBLIC_TAG_ID],
        //       handler,
        //     ),
        // });

        // fastify.register(graaspCategoryPlugin);

        // fastify.register(graaspValidationPlugin, {
        //   // this api needs to be defined from .env
        //   classifierApi: IMAGE_CLASSIFIER_API,
        //   fileItemType: FILE_ITEM_TYPE,
        //   fileConfigurations: {
        //     s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
        //     local: FILE_ITEM_PLUGIN_OPTIONS,
        //   },
        // });

        // fastify.register(graaspPluginItemLikes);

        // if (CHATBOX_PLUGIN) {
        //   fastify.register(graaspChatbox, { hosts: CLIENT_HOSTS });
        // }

        // if (WEBSOCKETS_PLUGIN) {
        //   registerItemWsHooks(
        //     websockets,
        //     runner,
        //     dbService,
        //     itemMembershipsDbService,
        //     taskManager,
        //     db.pool,
        //   );
        // }

        // isolate the core actions using fastify.register
        fastify.register(async function (fastify) {
          // onResponse hook that executes createAction in graasp-plugin-actions every time there is response
          // it is used to save the actions of the items
          // if (SAVE_ACTIONS) {
          //   const actionService = new ActionService();
          //   const actionTaskManager = new ActionTaskManager(
          //     actionService,
          //     taskManager,
          //     membership,
          //     mTM,
          //     CLIENT_HOSTS,
          //   );
          //   fastify.addHook('onResponse', async (request, reply) => {
          //     // todo: save public actions?
          //     if (request.member) {
          //       // wrap the itemActionHandler in a new function to provide it with the properties we already have
          //       const actionHandler = (actionInput: ActionHandlerInput): Promise<BaseAction[]> =>
          //         itemActionHandler(dbService, actionInput);
          //       const createActionTask = actionTaskManager.createCreateTask(request.member, {
          //         request,
          //         reply,
          //         handler: actionHandler,
          //       });
          //       await runner.runSingle(createActionTask);
          //     }
          //   });
          // }

          fastify.register(itemController);
        });
      });
    },
    { prefix: ITEMS_ROUTE_PREFIX },
  );
};

export default plugin;
