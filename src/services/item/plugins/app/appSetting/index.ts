import { FastifyPluginAsync } from 'fastify';

import { ItemType } from '@graasp/sdk';

import { resolveDependency } from '../../../../../di/utils';
import { IdParam } from '../../../../../types';
import { asDefined } from '../../../../../utils/assertions';
import { Repositories, buildRepositories } from '../../../../../utils/repositories';
import { authenticateAppsJWT } from '../../../../auth/plugins/passport';
import { matchOne } from '../../../../authorization';
import { Actor, assertIsMember } from '../../../../member/entities/member';
import { validatedMemberAccountRole } from '../../../../member/strategies/validatedMemberAccountRole';
import { Item } from '../../../entities/Item';
import { ItemService } from '../../../service';
import { appSettingsWsHooks } from '../ws/hooks';
import { AppSetting } from './appSettings';
import { InputAppSetting } from './interfaces/app-setting';
import appSettingFilePlugin from './plugins/file';
import common, { create, deleteOne, getForOne, updateOne } from './schemas';
import { AppSettingService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;

  // register app setting schema
  fastify.addSchema(common);

  const itemService = resolveDependency(ItemService);
  const appSettingService = resolveDependency(AppSettingService);

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
    fastify.register(appSettingFilePlugin, { appSettingService });

    // create app setting
    fastify.post<{ Params: { itemId: string }; Body: Partial<InputAppSetting> }>(
      '/:itemId/app-settings',
      {
        schema: create,
        preHandler: [authenticateAppsJWT, matchOne(validatedMemberAccountRole)],
      },
      async ({ user, params: { itemId }, body }) => {
        const member = asDefined(user?.account);
        assertIsMember(member);
        return db.transaction(async (manager) => {
          return appSettingService.post(member, buildRepositories(manager), itemId, body);
        });
      },
    );

    // update app setting
    fastify.patch<{ Params: { itemId: string } & IdParam; Body: Partial<AppSetting> }>(
      '/:itemId/app-settings/:id',
      {
        schema: updateOne,
        preHandler: [authenticateAppsJWT, matchOne(validatedMemberAccountRole)],
      },
      async ({ user, params: { itemId, id: appSettingId }, body }) => {
        const member = asDefined(user?.account);
        assertIsMember(member);
        return db.transaction(async (manager) => {
          return appSettingService.patch(
            member,
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
      {
        schema: deleteOne,
        preHandler: [authenticateAppsJWT, matchOne(validatedMemberAccountRole)],
      },
      async ({ user, params: { itemId, id: appSettingId } }) => {
        const member = asDefined(user?.account);
        assertIsMember(member);
        return db.transaction(async (manager) => {
          return appSettingService.deleteOne(
            member,
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
      { schema: getForOne, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId }, query: { name } }) => {
        return appSettingService.getForItem(user?.account, buildRepositories(), itemId, name);
      },
    );
  });
};

export default plugin;
