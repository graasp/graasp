import { fastifyCors } from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import { AppIdentification, AuthTokenSubject } from '@graasp/sdk';

import { notUndefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import {
  guestAuthenticateAppsJWT,
  isAuthenticated,
  optionalIsAuthenticated,
} from '../../../auth/plugins/passport';
import appActionPlugin from './appAction';
import appDataPlugin from './appData';
import appSettingPlugin from './appSetting';
import chatBotPlugin from './chatBot';
import { DEFAULT_JWT_EXPIRATION } from './constants';
import { createSchema, getMany, getMostUsed, updateSchema } from './fluent-schema';
import common, { generateToken, getContext } from './schemas';
import { AppService } from './service';
import { AppsPluginOptions } from './types';

const plugin: FastifyPluginAsync<AppsPluginOptions> = async (fastify, options) => {
  const { jwtSecret, jwtExpiration = DEFAULT_JWT_EXPIRATION, publisherId } = options;

  if (!jwtSecret) {
    throw new Error('jwtSecret is not defined!');
  }

  const {
    items: { service: itemService, extendCreateSchema, extendExtrasUpdateSchema },
  } = fastify;

  // "install" custom schema for validating document items creation
  extendCreateSchema(createSchema);
  // "install" custom schema for validating document items update
  extendExtrasUpdateSchema(updateSchema);

  fastify.addSchema(common);

  const appService = new AppService(itemService, jwtExpiration);

  // API endpoints
  fastify.register(async function (fastify) {
    // add CORS support that allows graasp's origin(s) + app publishers' origins.
    // TODO: not perfect because it's allowing apps' origins to call "/<id>/api-access-token",
    // even though they would not be able to fulfill the request because they need the
    // proper authentication
    const { corsPluginOptions } = fastify;
    if (corsPluginOptions) {
      const allowedOrigins = await appService.getAllValidAppOrigins(buildRepositories());

      const graaspAndAppsOrigins = corsPluginOptions.origin.concat(allowedOrigins);
      fastify.register(
        fastifyCors,
        Object.assign({}, corsPluginOptions, { origin: graaspAndAppsOrigins }),
      );
    }

    fastify.register(async function (fastify) {
      // get all apps
      fastify.get('/list', { schema: getMany }, async () => {
        return appService.getAllApps(buildRepositories(), publisherId);
      });

      fastify.get(
        '/most-used',
        { schema: getMostUsed, preHandler: isAuthenticated },
        async ({ user }) => {
          const member = notUndefined(user?.member);
          return appService.getMostUsedApps(member, buildRepositories());
        },
      );

      // generate api access token for member + (app-)item.
      fastify.post<{ Params: { itemId: string }; Body: { origin: string } & AppIdentification }>(
        '/:itemId/api-access-token',
        { schema: generateToken, preHandler: optionalIsAuthenticated },
        async (request) => {
          const {
            user,
            params: { itemId },
            body,
          } = request;

          return appService.getApiAccessToken(user?.member, buildRepositories(), itemId, body);
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

    fastify.register(async function (fastify) {
      // get app item context
      fastify.get<{ Params: { itemId: string } }>(
        '/:itemId/context',
        { schema: getContext, preHandler: guestAuthenticateAppsJWT },
        async ({ user, params: { itemId } }) => {
          const app = notUndefined(user?.app);
          const requestDetails: AuthTokenSubject = {
            memberId: user?.member?.id,
            itemId: app.item.id,
            origin: app.origin,
            key: app.key,
          };
          return appService.getContext(
            requestDetails.memberId,
            buildRepositories(),
            itemId,
            requestDetails,
          );
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
