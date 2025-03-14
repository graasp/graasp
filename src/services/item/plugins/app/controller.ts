import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { asDefined } from '../../../../utils/assertions.js';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport/index.js';
import { assertIsMember } from '../../../authentication.js';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole.js';
import { ActionItemService } from '../action/action.service.js';
import { AppItemService } from './appItemService.js';
import { createApp, updateApp } from './schemas.js';
import { AppsPluginOptions } from './types.js';

export const plugin: FastifyPluginAsyncTypebox<AppsPluginOptions> = async (fastify) => {
  // service for item app api
  const appItemService = resolveDependency(AppItemService);
  const actionItemService = resolveDependency(ActionItemService);

  fastify.post(
    '/apps',
    {
      schema: createApp,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        user,
        query: { parentId, previousItemId },
        body: data,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);

      const item = await db.transaction(async (tx) => {
        const item = await appItemService.postWithOptions(tx, member, {
          ...data,
          previousItemId,
          parentId,
        });
        return item;
      });

      reply.send(item);

      // background operations
      await actionItemService.postPostAction(db, request, item);
      await db.transaction(async (tx) => {
        await appItemService.rescaleOrderForParent(tx, member, item);
      });
    },
  );

  fastify.patch(
    '/apps/:id',
    {
      schema: updateApp,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request) => {
      const {
        user,
        params: { id },
        body,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);
      return await db.transaction(async (tx) => {
        const item = await appItemService.patch(tx, member, id, body);
        await actionItemService.postPatchAction(tx, request, item);
        return item;
      });
    },
  );
};
