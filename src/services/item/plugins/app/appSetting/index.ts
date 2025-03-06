import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ItemType } from '@graasp/sdk';

import { resolveDependency } from '../../../../../di/utils';
import { DBConnection, db } from '../../../../../drizzle/db';
import { AuthenticatedUser } from '../../../../../types';
import { asDefined } from '../../../../../utils/assertions';
import { authenticateAppsJWT } from '../../../../auth/plugins/passport';
import { assertIsMember } from '../../../../authentication';
import { matchOne } from '../../../../authorization';
import { validatedMemberAccountRole } from '../../../../member/strategies/validatedMemberAccountRole';
import { ItemService } from '../../../service';
import { appSettingsWsHooks } from '../ws/hooks';
import appSettingFilePlugin from './plugins/file';
import { create, deleteOne, getForOne, updateOne } from './schemas';
import { AppSettingService } from './service';

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
    async ({ user, params: { itemId, id: appSettingId } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      await db.transaction(async (tx) => {
        await appSettingService.deleteOne(tx, member, itemId, appSettingId);
      });
    },
  );

  // get app settings
  fastify.get<{ Params: { itemId: string }; Querystring: { name?: string } }>(
    '/:itemId/app-settings',
    { schema: getForOne, preHandler: authenticateAppsJWT },
    async ({ user, params: { itemId }, query: { name } }) => {
      return appSettingService.getForItem(db, user?.account, itemId, name);
    },
  );
};

export default plugin;
