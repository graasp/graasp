import fastifyCors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

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
  S3_FILE_ITEM_PLUGIN_OPTIONS,
  SAVE_ACTIONS,
  THUMBNAILS_PATH_PREFIX,
  THUMBNAILS_ROUTE_PREFIX,
  WEBSOCKETS_PLUGIN,
} from '../../util/config';
import graaspChatbox from '../chat';
import graaspInvitationsPlugin from '../invitation';
import graaspCategoryPlugin from '../itemCategory';
import graaspItemFlags from '../itemFlag';
import graaspItemLikes from '../itemLike';
import graaspItemLogin from '../itemLogin';
import graaspItemTags from '../itemTag';
import graaspItemPublish from '../published';
import itemController from './controller';
import {
  baseItemCreate,
  create,
  folderExtra,
  folderItemCreate,
  shortcutItemCreate,
  updateOne,
} from './fluent-schema';
// import { itemActionHandler } from './handler/item-action-handler';
import graaspApps from './plugins/app';
import graaspDocumentItem from './plugins/document';
import graaspEmbeddedLinkItem from './plugins/embeddedLink';
import graaspFileItem from './plugins/file';
import graaspZipPlugin from './plugins/importExport';
import graaspRecycledItemData from './plugins/recycled';
import thumbnailsPlugin from './plugins/thumbnail';
import graaspValidationPlugin from './plugins/validation';

// import { registerItemWsHooks } from './ws/hooks';

const plugin: FastifyPluginAsync = async (fastify) => {
  // we move this from fluent schema because it was a global value
  // this did not fit well with tests
  const initializedCreate = create(baseItemCreate, folderItemCreate, shortcutItemCreate);

  const initializedUpdate = updateOne(folderExtra);

  const { items } = fastify;
  // decoration to extend create and update schemas from other plugins
  items.extendCreateSchema = initializedCreate;
  items.extendExtrasUpdateSchema = initializedUpdate;

  // const itemTagService = new ItemTagService();

  fastify.decorate('file', {
    s3Config: S3_FILE_ITEM_PLUGIN_OPTIONS,
    localConfig: FILE_ITEM_PLUGIN_OPTIONS,
  });

  // deployed w/o the '/items' prefix and w/o auth pre-handler
  if (APPS_PLUGIN) {
    // this needs to execute before 'create()' and 'updateOne()' are called
    // because graaspApps extends the schemas
    await fastify.register(graaspApps, {
      jwtSecret: APPS_JWT_SECRET,
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

      // // plugins that don't require authentication
      fastify.register(graaspItemLogin);

      fastify.register(graaspCategoryPlugin);

      fastify.register(graaspItemPublish, {
        // publishedTagId: PUBLISHED_TAG_ID,
        // publicTagId: PUBLIC_TAG_ID,
        // graaspActor: GRAASP_ACTOR,
        // hostname: CLIENT_HOSTS.find(({ name }) => name === 'explorer')?.hostname,
      });

      fastify.register(graaspFileItem, {});

      fastify.register(graaspItemTags);

      // core routes - require authentication
      fastify.register(async function (fastify) {
        // // H5P plugin must be registered before ZIP
        // fastify.register(graaspItemH5P, {
        //   pathPrefix: H5P_PATH_PREFIX,
        //   fileItemType: FILE_ITEM_TYPE,
        //   fileConfigurations: {
        //     s3: H5P_CONTENT_PLUGIN_OPTIONS,
        //     local: FILE_ITEM_PLUGIN_OPTIONS,
        //   },
        // });

        fastify.register(graaspZipPlugin);

        fastify.register(thumbnailsPlugin);

        if (EMBEDDED_LINK_ITEM_PLUGIN) {
          // 'await' necessary because internally it uses 'extendCreateSchema'
          await fastify.register(graaspEmbeddedLinkItem, {
            iframelyHrefOrigin: EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN,
          });
        }

        await fastify.register(graaspDocumentItem);

        fastify.register(graaspInvitationsPlugin, {
          buildInvitationLink: (invitation) =>
            `${PROTOCOL}://${AUTH_CLIENT_HOST}/signup?invitationId=${invitation.id}`,
        });

        fastify.register(graaspItemFlags);

        fastify.register(graaspRecycledItemData);

        fastify.register(graaspValidationPlugin, {
          // this api needs to be defined from .env
          imageClassifierApi: IMAGE_CLASSIFIER_API,
        });

        fastify.register(graaspItemLikes);

        if (CHATBOX_PLUGIN) {
          fastify.register(graaspChatbox);
        }

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
