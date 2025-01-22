import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { asDefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { assertIsMember } from '../../../member/entities/member';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ActionItemService } from '../action/service';
import { AppItemService } from './appItemService';
import { createApp, updateApp } from './schemas';
import { AppsPluginOptions } from './types';

export const plugin: FastifyPluginAsyncTypebox<AppsPluginOptions> = async (fastify) => {
  const { db } = fastify;
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

      const item = await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const item = await appItemService.postWithOptions(member, repositories, {
          ...data,
          previousItemId,
          parentId,
        });
        return item;
      });

      reply.send(item);

      // background operations
      await actionItemService.postPostAction(request, buildRepositories(), item);
      await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        await appItemService.rescaleOrderForParent(member, repositories, item);
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
      return await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const item = await appItemService.patch(member, repositories, id, body);
        await actionItemService.postPatchAction(request, repositories, item);
        return item;
      });
    },
  );
};
