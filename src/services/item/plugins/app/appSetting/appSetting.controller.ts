import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ItemType } from '@graasp/sdk';

import { resolveDependency } from '../../../../../di/utils';
import { DBConnection, db } from '../../../../../drizzle/db';
import { AuthenticatedUser } from '../../../../../types';
import { asDefined } from '../../../../../utils/assertions';
import {
  authenticateAppsJWT,
  guestAuthenticateAppsJWT,
  matchOne,
} from '../../../../auth/plugins/passport';
import { assertIsMember } from '../../../../authentication';
import { validatedMemberAccountRole } from '../../../../member/strategies/validatedMemberAccountRole';
import { ItemService } from '../../../item.service';
import { appSettingsWsHooks } from '../ws/hooks';
import { create, deleteOne, getForOne, updateOne } from './appSetting.schemas';
import { AppSettingService } from './appSetting.service';
import appSettingFilePlugin from './plugins/file/appSetting.file.controller';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const itemService = resolveDependency(ItemService);
  const appSettingService = resolveDependency(AppSettingService);

  fastify.register(appSettingsWsHooks, { appSettingService });

  // copy app settings and related files on item copy
  const hook = async (actor: AuthenticatedUser, db: DBConnection, { original, copy }) => {
    if (original.type !== ItemType.APP || copy.type !== ItemType.APP) return;

    await appSettingService.copyForItem(db, actor, original, copy.id);
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
      return db.transaction(async (tx) => {
        return await appSettingService.post(tx, member, itemId, body);
      });
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
      return db.transaction(async (tx) => {
        return appSettingService.patch(tx, member, itemId, appSettingId, body);
      });
    },
  );

  // delete app setting
  fastify.delete(
    '/:itemId/app-settings/:id',
    {
      schema: deleteOne,
      preHandler: [authenticateAppsJWT, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params: { itemId, id: appSettingId } }, reply) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      await db.transaction(async (tx) => {
        await appSettingService.deleteOne(tx, member, itemId, appSettingId);
      });
      reply.status(StatusCodes.NO_CONTENT);
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
