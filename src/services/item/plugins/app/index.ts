import { promisify } from 'util';

import fastifyAuth from '@fastify/auth';
import fastifyBearerAuth from '@fastify/bearer-auth';
import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import { FastifyPluginAsync, FastifyRequest, preHandlerHookHandler } from 'fastify';

import { AppIdentification, AuthTokenSubject } from '@graasp/sdk';

import { buildRepositories } from '../../../../utils/repositories';
import appActionPlugin from './appAction';
import appDataPlugin from './appData';
import appSettingPlugin from './appSetting';
import { DEFAULT_JWT_EXPIRATION } from './constants';
import { createSchema, getMany, updateSchema } from './fluent-schema';
import common, { generateToken, getContext } from './schemas';
import { AppService } from './service';
import { AppsPluginOptions } from './types';

const plugin: FastifyPluginAsync<AppsPluginOptions> = async (fastify, options) => {
  const { jwtSecret, jwtExpiration = DEFAULT_JWT_EXPIRATION, publisherId } = options;

  if (!jwtSecret) {
    throw new Error('jwtSecret is not defined!');
  }

  const {
    verifyBearerAuth,
    items: { extendCreateSchema, extendExtrasUpdateSchema },
  } = fastify;

  if (!verifyBearerAuth) {
    throw new Error('verifyBearerAuth is not defined!');
  }

  // "install" custom schema for validating document items creation
  extendCreateSchema(createSchema);
  // "install" custom schema for validating document items update
  extendExtrasUpdateSchema(updateSchema);

  fastify.addSchema(common);

  // register auth plugin
  // jwt plugin to manipulate jwt token
  await fastify.register(fastifyJwt, { secret: jwtSecret });

  const promisifiedJwtSign = promisify<{ sub: AuthTokenSubject }, { expiresIn: string }, string>(
    fastify.jwt.sign,
  );

  const aS = new AppService(jwtExpiration, promisifiedJwtSign);

  const promisifiedJwtVerify = promisify<string, { sub: AuthTokenSubject }>(fastify.jwt.verify);

  const validateApiAccessToken = async (jwtToken: string, request: FastifyRequest) => {
    // try {
    // verify token and extract its data
    const { sub } = await promisifiedJwtVerify(jwtToken);

    // TODO: check if origin in token matches request's origin ?
    // (Origin header is only present in CORS request: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Origin)
    request.authTokenSubject = sub;
    return true;
    // } catch (error) {
    //   // const { log } = request;
    //   // log.warn('Invalid app api access token');
    //   return false;
    // }
  };

  // bearer token plugin to read and validate token in Bearer header
  fastify.decorateRequest('authTokenSubject', null);
  fastify.register(fastifyBearerAuth, {
    addHook: false,
    keys: new Set<string>(),
    auth: validateApiAccessToken,
  });

  // API endpoints
  fastify.register(async function (fastify) {
    // add CORS support that allows graasp's origin(s) + app publishers' origins.
    // TODO: not perfect because it's allowing apps' origins to call "/<id>/api-access-token",
    // even though they would not be able to fulfill the request because they need the
    // proper authentication
    const { corsPluginOptions } = fastify;
    if (corsPluginOptions) {
      const allowedOrigins = await aS.getAllValidAppOrigins(undefined, buildRepositories());

      const graaspAndAppsOrigins = corsPluginOptions.origin.concat(allowedOrigins);
      fastify.register(
        fastifyCors,
        Object.assign({}, corsPluginOptions, { origin: graaspAndAppsOrigins }),
      );
    }

    const getBearerToken = (request) => {
      const auth = request.headers.authorization;
      const token = auth.split(' ')[1];
      return token;
    };

    fastify.register(async function (fastify) {
      // get all apps
      fastify.get('/list', { schema: getMany }, async ({ member }) => {
        return aS.getAllApps(member, buildRepositories(), publisherId);
      });

      // generate api access token for member + (app-)item.
      fastify.post<{ Params: { itemId: string }; Body: { origin: string } & AppIdentification }>(
        '/:itemId/api-access-token',
        { schema: generateToken, preHandler: fastify.fetchMemberInSession },
        async (request) => {
          const {
            member,
            params: { itemId },
            body,
            log,
          } = request;

          // const token = getBearerToken(request);
          return aS.getApiAccessToken(member, buildRepositories(), itemId, body);
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
      await fastify.register(fastifyAuth);

      // get app item context
      fastify.get<{ Params: { itemId: string } }>(
        '/:itemId/context',
        {
          schema: getContext,
          preHandler: fastify.fetchMemberInSession,
        },
        async ({ member, authTokenSubject: requestDetails, params: { itemId }, log }) => {
          const memberId = member ? member.id : requestDetails?.memberId;
          return aS.getContext(memberId, buildRepositories(), itemId, requestDetails);
        },
      );
    });

    fastify.register(async function (fastify) {
      // all app endpoints need the bearer token
      fastify.addHook('preHandler', fastify.verifyBearerAuth as preHandlerHookHandler);

      // register app data plugin
      fastify.register(appDataPlugin);

      // register app action plugin
      fastify.register(appActionPlugin);

      // register app settings plugin
      fastify.register(appSettingPlugin);
    });
  });
};

export default plugin;
