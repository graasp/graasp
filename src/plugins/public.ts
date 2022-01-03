import { FastifyPluginAsync } from 'fastify';
import { ItemTagService } from 'graasp-item-tags';
import graaspPluginPublic, { PublicItemService, PublicItemTaskManager } from 'graasp-plugin-public';
import { publicPlugin as publicThumbnailsPlugin } from 'graasp-plugin-thumbnails';
import { publicPlugin as publicFileItemPlugin } from 'graasp-plugin-file-item';
import { publicPlugin as publicCategoriesPlugin } from 'graasp-plugin-categories';
import { publicPlugin as publicAppsPlugin } from 'graasp-apps';
import { publicPlugin as publicChatboxPlugin } from 'graasp-plugin-chatbox';
import {
  APPS_JWT_SECRET,
  AVATARS_PATH_PREFIX,
  FILES_PATH_PREFIX,
  FILE_ITEM_PLUGIN_OPTIONS,
  GRAASP_ACTOR,
  ITEMS_ROUTE_PREFIX,
  PUBLIC_TAG_ID,
  PUBLISHED_TAG_ID,
  S3_FILE_ITEM_PLUGIN_OPTIONS,
  SERVICE_METHOD,
  THUMBNAILS_PATH_PREFIX,
} from '../util/config';

export interface PublicPluginOptions {
  uri?: string;
  logs?: boolean;
}

const plugin: FastifyPluginAsync<PublicPluginOptions> = async (instance) => {
  const {
    items: { dbService: iS },
  } = instance;
  const itemTagService = new ItemTagService();
  const pIS = new PublicItemService(PUBLIC_TAG_ID);
  const pTM = new PublicItemTaskManager(pIS, iS, itemTagService, PUBLIC_TAG_ID);

  instance.decorate('public', {
    items: { taskManager: pTM, dbService: pIS },
    publishedTagId: PUBLISHED_TAG_ID,
    publicTagId: PUBLIC_TAG_ID,
    graaspActor: GRAASP_ACTOR,
  });

  // items, members, item memberships
  await instance.register(graaspPluginPublic);

  // item thumbnail, member avatar endpoints
  await instance.register(publicThumbnailsPlugin, {
    serviceMethod: SERVICE_METHOD,
    prefixes: {
      avatarsPrefix: AVATARS_PATH_PREFIX,
      thumbnailsPrefix: THUMBNAILS_PATH_PREFIX,
    },
    serviceOptions: {
      s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
      local: FILE_ITEM_PLUGIN_OPTIONS,
    },
  });

  // apps
  await instance.register(publicAppsPlugin, {
    jwtSecret: APPS_JWT_SECRET,
  });

  // files
  instance.register(
    async () => {
      await instance.register(publicFileItemPlugin, {
        shouldLimit: true,
        pathPrefix: FILES_PATH_PREFIX,
        serviceMethod: SERVICE_METHOD,
        serviceOptions: {
          s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
          local: FILE_ITEM_PLUGIN_OPTIONS,
        },
      });

      // categories
      await instance.register(publicCategoriesPlugin);

      // chatbox
      await instance.register(publicChatboxPlugin);
    },
    { prefix: ITEMS_ROUTE_PREFIX },
  );
};
export default plugin;
