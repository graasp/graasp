import { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';

import { IdParam, Item, ItemType } from '@graasp/sdk';

import { Repositories, buildRepositories } from '../../../../../utils/repositories';
import { Actor } from '../../../../member/entities/member';
import { AppSetting } from './appSettings';
import { InputAppSetting } from './interfaces/app-setting';
import appSettingFilePlugin from './plugins/file';
import common, { create, deleteOne, getForOne, updateOne } from './schemas';
import { AppSettingService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    items: { service: itemService },
    db,
  } = fastify;

  // register app setting schema
  fastify.addSchema(common);

  const appSettingService = new AppSettingService(itemService);

  // copy app settings and related files on item copy
  const hook = async (
    actor: Actor,
    repositories: Repositories,
    { original, copy }: { original: Item; copy: Item },
  ) => {
    if (original.type !== ItemType.APP || copy.type !== ItemType.APP) return;

    await appSettingService.copyForItem(actor, repositories, original, copy);
  };
  itemService.hooks.setPostHook('copy', hook);

  // endpoints accessible to third parties with Bearer token
  fastify.register(async function (fastify) {
    // TODO: allow CORS but only the origins in the table from approved publishers - get all
    // origins from the publishers table an build a rule with that.

    fastify.addHook('preHandler', fastify.verifyBearerAuth as preHandlerHookHandler);

    fastify.register(appSettingFilePlugin, { appSettingService });

    // create app setting
    fastify.post<{ Params: { itemId: string }; Body: Partial<InputAppSetting> }>(
      '/:itemId/app-settings',
      {
        schema: create,
      },
      async ({ authTokenSubject: requestDetails, params: { itemId }, body, log }) => {
        const memberId = requestDetails?.memberId;
        return db.transaction(async (manager) => {
          return appSettingService.post(memberId, buildRepositories(manager), itemId, body);
        });
      },
    );

    // update app setting
    fastify.patch<{ Params: { itemId: string } & IdParam; Body: Partial<AppSetting> }>(
      '/:itemId/app-settings/:id',
      { schema: updateOne },
      async ({
        authTokenSubject: requestDetails,
        params: { itemId, id: appSettingId },
        body,
        log,
      }) => {
        const memberId = requestDetails?.memberId;
        return db.transaction(async (manager) => {
          return appSettingService.patch(
            memberId,
            buildRepositories(manager),
            itemId,
            appSettingId,
            body,
          );
        });
      },
    );

    // delete app setting
    fastify.delete<{ Params: { itemId: string } & IdParam }>(
      '/:itemId/app-settings/:id',
      { schema: deleteOne },
      async ({ authTokenSubject: requestDetails, params: { itemId, id: appSettingId }, log }) => {
        const memberId = requestDetails?.memberId;

        return db.transaction(async (manager) => {
          return appSettingService.deleteOne(
            memberId,
            buildRepositories(manager),
            itemId,
            appSettingId,
          );
        });
      },
    );

    // get app settings
    fastify.get<{ Params: { itemId: string } }>(
      '/:itemId/app-settings',
      { schema: getForOne },
      async ({ authTokenSubject: requestDetails, params: { itemId }, log }) => {
        const memberId = requestDetails?.memberId;
        return appSettingService.getForItem(memberId, buildRepositories(), itemId);
      },
    );
  });
};

export default plugin;
