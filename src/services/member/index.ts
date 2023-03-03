import fastifyCors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import { IdParam, IdsParams } from '@graasp/sdk';

import {
  AVATARS_PATH_PREFIX,
  FILE_ITEM_PLUGIN_OPTIONS,
  FILE_ITEM_TYPE,
  S3_FILE_ITEM_PLUGIN_OPTIONS,
  STRIPE_DEFAULT_PLAN_PRICE_ID,
  STRIPE_SECRET_KEY,
  SUBSCRIPTION_PLUGIN,
  SUBSCRIPTION_ROUTE_PREFIX,
} from '../../util/config';
import { CannotModifyOtherMembers } from '../../util/graasp-error';
import memberController from './controller';
import common, { deleteOne, getCurrent, getMany, getManyBy, getOne, updateOne } from './schemas';

const ROUTES_PREFIX = '/members';

const plugin: FastifyPluginAsync = async (fastify) => {
  // schemas
  fastify.addSchema(common);

  // routes
  fastify.register(
    memberController,
    // async function (fastify) {
    // add CORS support
    // if (fastify.corsPluginOptions) {
    //   fastify.register(fastifyCors, fastify.corsPluginOptions);
    // }

    // // auth plugin session validation
    // fastify.addHook('preHandler', fastify.verifyAuthentication);

    // fastify.decorate('s3FileItemPluginOptions', S3_FILE_ITEM_PLUGIN_OPTIONS);
    // fastify.decorate('fileItemPluginOptions', FILE_ITEM_PLUGIN_OPTIONS);

    // fastify.register(thumbnailsPlugin, {
    //   fileItemType: FILE_ITEM_TYPE,
    //   fileConfigurations: {
    //     s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
    //     local: FILE_ITEM_PLUGIN_OPTIONS,
    //   },
    //   pathPrefix: AVATARS_PATH_PREFIX,

    //   uploadPreHookTasks: async ({ parentId: id }, { member }) => {
    //     if (member.id !== id) {
    //       throw new CannotModifyOtherMembers(member.id);
    //     }
    //     return [taskManager.createGetTask(member, id)];
    //   },
    //   downloadPreHookTasks: async ({ itemId: id, filename }, { member }) => {
    //     const task = taskManager.createGetTask(member, id);
    //     task.getResult = () => ({
    //       filepath: buildFilePathWithPrefix({
    //         itemId: (task.result as Member).id,
    //         pathPrefix: AVATARS_PATH_PREFIX,
    //         filename,
    //       }),
    //       mimetype: THUMBNAIL_MIMETYPE,
    //     });

    //     return [task];
    //   },

    //   prefix: '/avatars',
    // });

    // if (SUBSCRIPTION_PLUGIN) {
    //   fastify.register(subscriptionsPlugin, {
    //     stripeSecretKey: STRIPE_SECRET_KEY,
    //     stripeDefaultProductId: STRIPE_DEFAULT_PLAN_PRICE_ID,
    //     prefix: SUBSCRIPTION_ROUTE_PREFIX,
    //   });
    // }
    // }
    { prefix: ROUTES_PREFIX },
  );
};

export default plugin;
