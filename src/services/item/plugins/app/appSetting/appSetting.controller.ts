import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../../di/utils';
import { type DBConnection, db } from '../../../../../drizzle/db';
import type { ItemRaw } from '../../../../../drizzle/types';
import type { AuthenticatedUser } from '../../../../../types';
import { asDefined } from '../../../../../utils/assertions';
import {
  authenticateAppsJWT,
  guestAuthenticateAppsJWT,
  matchOne,
} from '../../../../auth/plugins/passport';
import { assertIsMember } from '../../../../authentication';
import { AuthorizedItemService } from '../../../../authorizedItem.service';
import { validatedMemberAccountRole } from '../../../../member/strategies/validatedMemberAccountRole';
import { ItemService } from '../../../item.service';
import { AppSettingEvent, appSettingsTopic } from '../ws/events';
import { checkItemIsApp } from '../ws/utils';
import { create, deleteOne, getForOne, updateOne } from './appSetting.schemas';
import { AppSettingService } from './appSetting.service';
import appSettingFilePlugin from './plugins/file/appSetting.file.controller';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { websockets } = fastify;
  const itemService = resolveDependency(ItemService);
  const appSettingService = resolveDependency(AppSettingService);
  const authorizedItemService = resolveDependency(AuthorizedItemService);

  websockets.register(appSettingsTopic, async (req) => {
    const { channel: id, member } = req;
    const item = await authorizedItemService.getItemById(db, { accountId: member?.id, itemId: id });
    checkItemIsApp(item);
  });

  // copy app settings and related files on item copy
  const hook = async (
    actor: AuthenticatedUser,
    dbConnection: DBConnection,
    { original, copy }: { original: ItemRaw; copy: ItemRaw },
  ) => {
    if (original.type !== 'app' || copy.type !== 'app') return;

    await appSettingService.copyForItem(dbConnection, actor, original, copy.id);
  };
  itemService.hooks.setPostHook('copy', hook);

  fastify.register(appSettingFilePlugin, { appSettingService });

  // create app setting
  fastify.post(
    '/:itemId/app-settings',
    {
      schema: create,
      preHandler: [authenticateAppsJWT, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params: { itemId }, body }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      const appSetting = await db.transaction(async (tx) => {
        return await appSettingService.post(tx, member, itemId, body);
      });

      websockets.publish(appSettingsTopic, itemId, AppSettingEvent('post', appSetting));

      return appSetting;
    },
  );

  // update app setting
  fastify.patch(
    '/:itemId/app-settings/:id',
    {
      schema: updateOne,
      preHandler: [authenticateAppsJWT, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params: { itemId, id: appSettingId }, body }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      const appSetting = await db.transaction(async (tx) => {
        return await appSettingService.patch(tx, member, itemId, appSettingId, body);
      });

      websockets.publish(appSettingsTopic, itemId, AppSettingEvent('patch', appSetting));

      return appSetting;
    },
  );

  // delete app setting
  fastify.delete(
    '/:itemId/app-settings/:id',
    {
      schema: deleteOne,
      preHandler: [authenticateAppsJWT, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params: { itemId, id: appSettingId } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      const appSetting = await db.transaction(async (tx) => {
        return await appSettingService.deleteOne(tx, member, itemId, appSettingId);
      });

      websockets.publish(appSettingsTopic, itemId, AppSettingEvent('delete', appSetting));

      return appSetting.id;
    },
  );

  // get app settings
  fastify.get<{ Params: { itemId: string }; Querystring: { name?: string } }>(
    '/:itemId/app-settings',
    { schema: getForOne, preHandler: guestAuthenticateAppsJWT },
    async ({ user, params: { itemId }, query: { name } }) => {
      return appSettingService.getForItem(db, user?.account, itemId, name);
    },
  );
};

export default plugin;
