import fastifyCors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import {
  APPS_JWT_SECRET,
  APPS_PUBLISHER_ID,
  APP_ITEMS_PREFIX,
  EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN,
  ETHERPAD_API_KEY,
  ETHERPAD_COOKIE_DOMAIN,
  ETHERPAD_PUBLIC_URL,
  ETHERPAD_URL,
  FILE_ITEM_PLUGIN_OPTIONS,
  IMAGE_CLASSIFIER_API,
  ITEMS_ROUTE_PREFIX,
  S3_FILE_ITEM_PLUGIN_OPTIONS,
} from '../../utils/config';
import graaspChatbox from '../chat';
import graaspItemLogin from '../itemLogin';
import itemController from './controller';
import itemSchema, {
  baseItemCreate,
  create,
  folderExtra,
  folderItemCreate,
  shortcutItemCreate,
  updateOne,
} from './fluent-schema';
import actionItemPlugin from './plugins/action';
import graaspApps from './plugins/app';
import graaspDocumentItem from './plugins/document';
import graaspEmbeddedLinkItem from './plugins/embeddedLink';
import graaspEtherpadPlugin from './plugins/etherpad';
import graaspFileItem from './plugins/file';
import itemGeolocationPlugin from './plugins/geolocation/index';
import graaspH5PPlugin from './plugins/html/h5p';
import graaspZipPlugin from './plugins/importExport';
import graaspInvitationsPlugin from './plugins/invitation';
import graaspCategoryPlugin from './plugins/itemCategory';
import graaspFavoritePlugin from './plugins/itemFavorite';
import graaspItemFlags from './plugins/itemFlag';
import graaspItemLikes from './plugins/itemLike';
import graaspItemTags from './plugins/itemTag';
import graaspItemPublish from './plugins/published';
import graaspRecycledItemData from './plugins/recycled';
import ShortLinkService from './plugins/shortLink';
import { SHORT_LINKS_ROUTE_PREFIX } from './plugins/shortLink/service';
import thumbnailsPlugin from './plugins/thumbnail';
import graaspValidationPlugin from './plugins/validation';
import { itemWsHooks } from './ws/hooks';

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.addSchema(itemSchema);

  fastify.decorate('file', {
    s3Config: S3_FILE_ITEM_PLUGIN_OPTIONS,
    localConfig: FILE_ITEM_PLUGIN_OPTIONS,
  });

  // this needs to execute before 'create()' and 'updateOne()' are called
  // because graaspApps extends the schemas
  fastify.register(graaspApps, {
    jwtSecret: APPS_JWT_SECRET,
    prefix: APP_ITEMS_PREFIX,
    publisherId: APPS_PUBLISHER_ID,
  });

  // we move this from fluent schema because it was a global value
  // this did not fit well with tests
  const initializedCreate = create(baseItemCreate, folderItemCreate, shortcutItemCreate);

  const initializedUpdate = updateOne(folderExtra);

  const { items } = fastify;
  // decoration to extend create and update schemas from other plugins
  items.extendCreateSchema = initializedCreate;
  items.extendExtrasUpdateSchema = initializedUpdate;

  await fastify.register(
    async function (fastify) {
      // add CORS support
      if (fastify.corsPluginOptions) {
        fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      // // plugins that don't require authentication
      fastify.register(graaspItemLogin);

      fastify.register(graaspCategoryPlugin);

      fastify.register(graaspFavoritePlugin);

      fastify.register(graaspItemPublish);

      fastify.register(thumbnailsPlugin);

      fastify.register(graaspFileItem, {});

      fastify.register(graaspItemTags);

      fastify.register(ShortLinkService, {
        prefix: SHORT_LINKS_ROUTE_PREFIX,
      });

      // core routes - require authentication
      fastify.register(async function (fastify) {
        fastify.register(itemWsHooks);

        // H5P plugin must be registered before ZIP
        fastify.register(graaspH5PPlugin);

        fastify.register(graaspEtherpadPlugin, {
          url: ETHERPAD_URL,
          apiKey: ETHERPAD_API_KEY,
          publicUrl: ETHERPAD_PUBLIC_URL,
          cookieDomain: ETHERPAD_COOKIE_DOMAIN,
        });

        fastify.register(graaspZipPlugin);

        // 'await' necessary because internally it uses 'extendCreateSchema'
        await fastify.register(graaspEmbeddedLinkItem, {
          iframelyHrefOrigin: EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN,
        });

        await fastify.register(graaspDocumentItem);

        fastify.register(graaspInvitationsPlugin);

        fastify.register(graaspItemFlags);

        fastify.register(graaspRecycledItemData);

        fastify.register(graaspValidationPlugin, {
          // this api needs to be defined from .env
          imageClassifierApi: IMAGE_CLASSIFIER_API,
        });

        fastify.register(graaspItemLikes);

        fastify.register(fp(graaspChatbox));

        fastify.register(actionItemPlugin);

        fastify.register(itemGeolocationPlugin);

        fastify.register(itemController);
      });
    },
    { prefix: ITEMS_ROUTE_PREFIX },
  );
};

export default plugin;
