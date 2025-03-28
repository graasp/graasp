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
} from '../../utils/config';
import chatController from '../chat/chatMessage.controller';
import graaspItemLogin from '../itemLogin/itemLogin.controller';
import itemController from './item.controller';
import actionItemPlugin from './plugins/action';
import graaspApps from './plugins/app';
import { plugin as graaspAppItem } from './plugins/app/controller';
import graaspDocumentItem from './plugins/document/controller';
import { PREFIX_DOCUMENT } from './plugins/document/service';
import graaspEmbeddedLinkItem from './plugins/embeddedLink/controller';
import { PREFIX_EMBEDDED_LINK } from './plugins/embeddedLink/service';
import graaspEnrollPlugin from './plugins/enroll';
import graaspEtherpadPlugin from './plugins/etherpad/controller';
import graaspFileItem from './plugins/file';
import graaspFolderItem from './plugins/folder/controller';
import itemGeolocationPlugin from './plugins/geolocation/itemGeolocation.controller';
import graaspH5PPlugin from './plugins/html/h5p/h5p.controller';
import graaspZipPlugin from './plugins/importExport';
import graaspInvitationsPlugin from './plugins/invitation/invitation.controller';
import graaspFavoritePlugin from './plugins/itemBookmark/itemBookmark.controller';
import graaspItemFlags from './plugins/itemFlag/itemFlag.controller';
import graaspItemLikes from './plugins/itemLike/itemLike.controller';
import graaspItemVisibility from './plugins/itemVisibility';
import graaspItemPublicationState from './plugins/publication/publicationState';
import graaspItemPublish from './plugins/publication/published';
import graaspValidationPlugin from './plugins/publication/validation';
import graaspRecycledItemData from './plugins/recycled';
import ShortLinkService from './plugins/shortLink/shortlink.controller';
import { SHORT_LINKS_ROUTE_PREFIX } from './plugins/shortLink/shortlink.service';
import { plugin as graaspShortcutPlugin } from './plugins/shortcut/controller';
import graaspItemTagPlugin from './plugins/tag/controller';
import thumbnailsPlugin from './plugins/thumbnail/itemThumbnail.controller';
import { itemWsHooks } from './ws/hooks';

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

        fastify.register(fp(chatController));

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
