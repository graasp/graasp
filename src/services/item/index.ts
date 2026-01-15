import { fastifyCors } from '@fastify/cors';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { APPS_JWT_SECRET } from '../../config/secrets';
import { APPS_PUBLISHER_ID } from '../../utils/config';
import chatController from '../chat/chatMessage.controller';
import graaspItemLogin from '../itemLogin/itemLogin.controller';
import { itemMembershipsController } from '../itemMembership/membership.controller';
import itemController from './item.controller';
import actionItemPlugin from './plugins/action/itemAction.controller';
import graaspApps from './plugins/app/app.controller';
import { plugin as graaspAppItem } from './plugins/app/appItem.controller';
import { capsulePlugin } from './plugins/capsule/capsule.controller';
import graaspDocumentItem from './plugins/document/document.controller';
import { PREFIX_DOCUMENT } from './plugins/document/document.service';
import graaspEmbeddedLinkItem from './plugins/embeddedLink/link.controller';
import { PREFIX_EMBEDDED_LINK } from './plugins/embeddedLink/link.service';
import graaspEnrollPlugin from './plugins/enroll/enroll.controller';
import graaspEtherpadPlugin from './plugins/etherpad/etherpad.controller';
import graaspFileItem from './plugins/file/itemFile.controller';
import graaspFolderItem from './plugins/folder/folder.controller';
import itemGeolocationPlugin from './plugins/geolocation/itemGeolocation.controller';
import graaspH5PPlugin from './plugins/html/h5p/h5p.controller';
import graaspImportExportPlugin from './plugins/importExport/importExport.controller';
import graaspInvitationsPlugin from './plugins/invitation/invitation.controller';
import graaspFavoritePlugin from './plugins/itemBookmark/itemBookmark.controller';
import graaspItemFlags from './plugins/itemFlag/itemFlag.controller';
import graaspItemLikes from './plugins/itemLike/itemLike.controller';
import graaspItemVisibility from './plugins/itemVisibility/itemVisibility.controller';
import { pageItemPlugin } from './plugins/page/page.controller';
import graaspItemPublicationState from './plugins/publication/publicationState/publication.controller';
import graaspItemPublish from './plugins/publication/published/itemPublished.controller';
import graaspValidationPlugin from './plugins/publication/validation/itemValidation.controller';
import graaspRecycledItemData from './plugins/recycled/recycled.controller';
import ShortLinkService from './plugins/shortLink/shortlink.controller';
import { SHORT_LINKS_ROUTE_PREFIX } from './plugins/shortLink/shortlink.service';
import { plugin as graaspShortcutPlugin } from './plugins/shortcut/shortcut.controller';
import graaspItemTagPlugin from './plugins/tag/itemTag.controller';
import thumbnailsPlugin from './plugins/thumbnail/itemThumbnail.controller';
import { itemWsHooks } from './ws/item.hooks';

const plugin: FastifyPluginAsync = async (fastify) => {
  // this needs to execute before 'create()' and 'updateOne()' are called
  // because graaspApps extends the schemas
  await fastify.register(graaspApps, {
    jwtSecret: APPS_JWT_SECRET,
    prefix: '/app-items',
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

      fastify.register(itemMembershipsController);

      fastify.register(graaspShortcutPlugin);

      fastify.register(thumbnailsPlugin);

      fastify.register(graaspFileItem, {});

      fastify.register(graaspItemVisibility);

      fastify.register(graaspFolderItem);

      fastify.register(capsulePlugin);

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

        fastify.register(graaspImportExportPlugin);

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

        fastify.register(pageItemPlugin);

        fastify.register(itemController);
      });
    },
    { prefix: '/items' },
  );
};

export default plugin;
