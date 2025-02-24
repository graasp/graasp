import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../../di/utils';
import { db } from '../../../../../drizzle/db';
import { FastifyInstanceTypebox } from '../../../../../plugins/typebox';
import { asDefined } from '../../../../../utils/assertions';
import { authenticateAppsJWT } from '../../../../auth/plugins/passport';
import { addMemberInAppAction } from '../legacy';
import { appActionsWsHooks } from '../ws/hooks';
import { create, getForOne } from './schemas';
import { AppActionService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const appActionService = resolveDependency(AppActionService);

  // endpoints accessible to third parties with Bearer token
  fastify.register(async function (fastify: FastifyInstanceTypebox) {
    fastify.register(appActionsWsHooks, { appActionService });

    // create app action
    fastify.post(
      '/:itemId/app-action',
      { schema: create, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId }, body }) => {
        const member = asDefined(user?.account);
        return db.transaction(async (tx) => {
          return addMemberInAppAction(await appActionService.post(tx, member, itemId, body));
        });
      },
    );

    // get app action
    fastify.get(
      '/:itemId/app-action',
      { schema: getForOne, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId }, query: filters }) => {
        const member = asDefined(user?.account);
        let accountId: string | undefined;
        if ('accountId' in filters) {
          accountId = filters.accountId;
        } else if ('memberId' in filters) {
          accountId = filters.memberId;
        }

        const appActions = await appActionService.getForItem(db, member, itemId, {
          accountId,
        });
        return appActions.map(addMemberInAppAction);
      },
    );
  });
};

export default plugin;
