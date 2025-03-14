import { fastifyCors } from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import {
  APPS_JWT_SECRET,
  APPS_PUBLISHER_ID,
  APP_ITEMS_PREFIX,
  FILE_ITEM_PLUGIN_OPTIONS,
  ITEMS_ROUTE_PREFIX,
  S3_FILE_ITEM_PLUGIN_OPTIONS,
} from '../../utils/config.js';
import graaspChatbox from '../chat/index.js';
import graaspItemLogin from '../itemLogin/index.js';
import itemController from './item.controller.js';
import actionItemPlugin from './plugins/action/index.js';
import { plugin as graaspAppItem } from './plugins/app/controller.js';
import graaspApps from './plugins/app/index.js';
import graaspDocumentItem from './plugins/document/controller.js';
import { PREFIX_DOCUMENT } from './plugins/document/service.js';
import graaspEmbeddedLinkItem from './plugins/embeddedLink/controller.js';
import { PREFIX_EMBEDDED_LINK } from './plugins/embeddedLink/service.js';
import graaspEnrollPlugin from './plugins/enroll/index.js';
import graaspEtherpadPlugin from './plugins/etherpad/controller.js';
import graaspFileItem from './plugins/file/index.js';
import graaspFolderItem from './plugins/folder/controller.js';
import itemGeolocationPlugin from './plugins/geolocation/index.js';
import graaspH5PPlugin from './plugins/html/h5p/index.js';
import graaspZipPlugin from './plugins/importExport/index.js';
import graaspInvitationsPlugin from './plugins/invitation/index.js';
import graaspFavoritePlugin from './plugins/itemBookmark/index.js';
import graaspItemFlags from './plugins/itemFlag/index.js';
import graaspItemLikes from './plugins/itemLike/index.js';
import graaspItemVisibility from './plugins/itemVisibility/index.js';
import graaspItemPublicationState from './plugins/publication/publicationState/index.js';
import graaspItemPublish from './plugins/publication/published/index.js';
import graaspValidationPlugin from './plugins/publication/validation/index.js';
import graaspRecycledItemData from './plugins/recycled/index.js';
import ShortLinkService from './plugins/shortLink/index.js';
import { SHORT_LINKS_ROUTE_PREFIX } from './plugins/shortLink/service.js';
import { plugin as graaspShortcutPlugin } from './plugins/shortcut/controller.js';
import graaspItemTagPlugin from './plugins/tag/controller.js';
import thumbnailsPlugin from './plugins/thumbnail/index.js';
import { itemWsHooks } from './ws/hooks.js';

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('file', {
    s3Config: S3_FILE_ITEM_PLUGIN_OPTIONS,
    localConfig: FILE_ITEM_PLUGIN_OPTIONS,
  });

  // this needs to execute before 'create()' and 'updateOne()' are called
  // because graaspApps extends the schemas
  await fastify.register(graaspApps, {
    jwtSecret: APPS_JWT_SECRET,
    prefix: APP_ITEMS_PREFIX,
    publisherId: APPS_PUBLISHER_ID,
  });

  await fastify.register(
    async function (fastify) {
      // add CORS support
      if (fastify.corsPluginOptions) {
        fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      // plugins that don't require authentication
      fastify.register(graaspItemLogin);

      fastify.register(graaspFavoritePlugin);

      fastify.register(graaspItemPublish);

      fastify.register(graaspShortcutPlugin);

      fastify.register(thumbnailsPlugin);

      fastify.register(graaspFileItem, {});

      fastify.register(graaspItemVisibility);

      fastify.register(graaspFolderItem);

      fastify.register(graaspAppItem);

      fastify.register(ShortLinkService, {
        prefix: SHORT_LINKS_ROUTE_PREFIX,
      });

      fastify.register(graaspItemPublicationState);

      // core routes - require authentication
      fastify.register(async function (fastify) {
        fastify.register(itemWsHooks);

        // H5P plugin must be registered before ZIP
        fastify.register(graaspH5PPlugin);

        fastify.register(graaspEtherpadPlugin);

        fastify.register(graaspZipPlugin);

        fastify.register(graaspEmbeddedLinkItem, {
          prefix: PREFIX_EMBEDDED_LINK,
        });

        fastify.register(graaspDocumentItem, { prefix: PREFIX_DOCUMENT });

        fastify.register(graaspInvitationsPlugin);

        fastify.register(graaspEnrollPlugin);

        fastify.register(graaspItemFlags);

        fastify.register(graaspRecycledItemData);

        fastify.register(graaspValidationPlugin);

        fastify.register(graaspItemLikes);

        fastify.register(fp(graaspChatbox));

        fastify.register(actionItemPlugin);

        fastify.register(itemGeolocationPlugin);

        fastify.register(graaspItemTagPlugin);

        fastify.register(itemController);
      });
    },
    { prefix: ITEMS_ROUTE_PREFIX },
  );
};

export default plugin;
