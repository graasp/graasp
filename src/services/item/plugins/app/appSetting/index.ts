import { FastifyPluginAsync, preHandlerHookHandler } from 'fastify';

import { ItemType } from '@graasp/sdk';

import { IdParam } from '../../../../../types';
import { Repositories, buildRepositories } from '../../../../../utils/repositories';
import { Actor } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { appSettingsWsHooks } from '../ws/hooks';
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

  fastify.register(appSettingsWsHooks, { appSettingService });

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
    fastify.addHook('preHandler', fastify.verifyBearerAuth as preHandlerHookHandler);

    fastify.register(appSettingFilePlugin, { appSettingService });

    // create app setting
    fastify.post<{ Params: { itemId: string }; Body: Partial<InputAppSetting> }>(
      '/:itemId/app-settings',
      {
        schema: create,
      },
      async ({ authTokenSubject: requestDetails, params: { itemId }, body }) => {
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
      async ({ authTokenSubject: requestDetails, params: { itemId, id: appSettingId }, body }) => {
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
      async ({ authTokenSubject: requestDetails, params: { itemId, id: appSettingId } }) => {
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
    fastify.get<{ Params: { itemId: string }; Querystring: { name?: string } }>(
      '/:itemId/app-settings',
      { schema: getForOne },
      async ({ authTokenSubject: requestDetails, params: { itemId }, query: { name } }) => {
        const memberId = requestDetails?.memberId;
        return appSettingService.getForItem(memberId, buildRepositories(), itemId, name);
      },
    );
  });
};

export default plugin;
