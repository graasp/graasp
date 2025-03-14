import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../../di/utils.js';
import { db } from '../../../../../drizzle/db.js';
import { FastifyInstanceTypebox } from '../../../../../plugins/typebox.js';
import { asDefined } from '../../../../../utils/assertions.js';
import { authenticateAppsJWT } from '../../../../auth/plugins/passport/index.js';
import { addMemberInAppAction } from '../legacy.js';
import { appActionsWsHooks } from '../ws/hooks.js';
import { AppActionService } from './appAction.service.js';
import { create, getForOne } from './schemas.js';

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
        await db.transaction(async (tx) => {
          addMemberInAppAction(await appActionService.post(tx, member, itemId, body));
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
