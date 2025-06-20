import { fastifyCors } from '@fastify/cors';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import type { AuthTokenSubject } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import type { FastifyInstanceTypebox } from '../../../../plugins/typebox';
import { asDefined } from '../../../../utils/assertions';
import {
  guestAuthenticateAppsJWT,
  isAuthenticated,
  optionalIsAuthenticated,
} from '../../../auth/plugins/passport';
import { generateToken, getContext, getList, getOwnMostUsedApps } from './app.schemas';
import { AppService } from './app.service';
import appActionPlugin from './appAction/appAction.controller';
import appDataPlugin from './appData/appData.controller';
import appSettingPlugin from './appSetting/appSetting.controller';
import chatBotPlugin from './chatBot/chatBot.controller';
import type { AppsPluginOptions } from './types';

const plugin: FastifyPluginAsyncTypebox<AppsPluginOptions> = async (fastify, options) => {
  const { jwtSecret, publisherId } = options;

  if (!jwtSecret) {
    throw new Error('jwtSecret is not defined!');
  }
  const appService = resolveDependency(AppService);

  // API endpoints
  fastify.register(async function (fastify: FastifyInstanceTypebox) {
    // add CORS support that allows graasp's origin(s) + app publishers' origins.
    // TODO: not perfect because it's allowing apps' origins to call "/<id>/api-access-token",
    // even though they would not be able to fulfill the request because they need the
    // proper authentication
    const { corsPluginOptions } = fastify;
    if (corsPluginOptions) {
      const allowedOrigins = await appService.getAllValidAppOrigins(db);

      const graaspAndAppsOrigins = corsPluginOptions.origin.concat(allowedOrigins);
      fastify.register(
        fastifyCors,
        Object.assign({}, corsPluginOptions, { origin: graaspAndAppsOrigins }),
      );
    }

    fastify.register(async function (fastify: FastifyInstanceTypebox) {
      // get all apps
      fastify.get('/list', { schema: getList }, async () => {
        return appService.getAllApps(db, publisherId);
      });

      fastify.get(
        '/most-used',
        { schema: getOwnMostUsedApps, preHandler: isAuthenticated },
        async ({ user }) => {
          const member = asDefined(user?.account);
          return appService.getMostUsedApps(db, member);
        },
      );

      // generate api access token for member + (app-)item.
      fastify.post(
        '/:itemId/api-access-token',
        { schema: generateToken, preHandler: optionalIsAuthenticated },
        async (request) => {
          const {
            user,
            params: { itemId },
            body,
          } = request;

          return appService.getApiAccessToken(db, user?.account, itemId, body);
        },
      );

      // TODO THUMBNAILS
      // register thumbnail plugin for creation hook
      // fastify.register(ThumbnailsPlugin, {
      //   fileItemType,
      //   fileConfigurations: {
      //     s3: s3Config,
      //     local: localConfig,
      //   },
      //   pathPrefix: APPS_TEMPLATE_PATH_PREFIX,
      //   enableAppsHooks: {
      //     appsTemplateRoot: APPS_TEMPLATE_PATH_PREFIX,
      //     itemsRoot: thumbnailsPrefix,
      //   },
      //   uploadPreHookTasks: async (_id, _args) => {
      //     throw new Error('The upload endpoint is not implemented');
      //   },
      //   downloadPreHookTasks: async (_payload, _args) => {
      //     throw new Error('The download endpoint is not implemented');
      //   },

      //   prefix: THUMBNAILS_ROUTE,
      // });
    });

    fastify.register(async function (fastify: FastifyInstanceTypebox) {
      // get app item context
      fastify.get(
        '/:itemId/context',
        { schema: getContext, preHandler: guestAuthenticateAppsJWT },
        async ({ user, params: { itemId } }) => {
          const app = asDefined(user?.app);
          const actor = user?.account;
          const requestDetails: AuthTokenSubject = {
            accountId: actor?.id,
            itemId: app.item.id,
            origin: app.origin,
            key: app.key,
          };
          return appService.getContext(db, actor, itemId, requestDetails);
        },
      );

      // register app data plugin
      fastify.register(appDataPlugin);

      // register app action plugin
      fastify.register(appActionPlugin);

      // register app settings plugin
      fastify.register(appSettingPlugin);

      // register app chatbot plugin
      fastify.register(chatBotPlugin);
    });
  });
};

export default plugin;
