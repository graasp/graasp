import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../../di/utils';
import { db } from '../../../../../drizzle/db';
import type { FastifyInstanceTypebox } from '../../../../../plugins/typebox';
import { asDefined } from '../../../../../utils/assertions';
import { authenticateAppsJWT } from '../../../../auth/plugins/passport';
import { AuthorizedItemService } from '../../../../authorizedItem.service';
import { addMemberInAppAction } from '../legacy';
import { AppActionEvent, appActionsTopic } from '../ws/events';
import { checkItemIsApp } from '../ws/utils';
import { create, getForOne } from './appAction.schemas';
import { AppActionService } from './appAction.service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const appActionService = resolveDependency(AppActionService);

  // endpoints accessible to third parties with Bearer token
  fastify.register(async function (fastify: FastifyInstanceTypebox) {
    const { websockets } = fastify;

    const authorizedItemService = resolveDependency(AuthorizedItemService);

    websockets.register(appActionsTopic, async (req) => {
      const { channel: id, member } = req;
      const item = await authorizedItemService.getItemById(db, {
        accountId: member?.id,
        itemId: id,
        permission: 'admin',
      });
      checkItemIsApp(item);
    });

    // create app action
    fastify.post(
      '/:itemId/app-action',
      { schema: create, preHandler: authenticateAppsJWT },
      async ({ user, params: { itemId }, body }, reply) => {
        const member = asDefined(user?.account);
        await db
          .transaction(async (tx) => {
            return addMemberInAppAction(await appActionService.post(tx, member, itemId, body));
          })
          .then((appAction) => {
            websockets.publish(appActionsTopic, itemId, AppActionEvent('post', appAction));
          });
        reply.status(StatusCodes.NO_CONTENT);
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
