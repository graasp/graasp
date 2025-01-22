import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { asDefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { assertIsMember } from '../../../member/entities/member';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ShortcutItem } from '../../entities/Item';
import { ItemService } from '../../service';
import { ActionItemService } from '../action/service';
import { createShortcut, updateShortcut } from './schemas';
import { ShortcutItemService } from './service';

export const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;
  const itemService = resolveDependency(ItemService);
  const shortcutService = resolveDependency(ShortcutItemService);
  const actionItemService = resolveDependency(ActionItemService);

  fastify.post(
    '/shortcuts',
    {
      schema: createShortcut,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        user,
        query: { parentId, previousItemId },
        body,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);

      const newItem = await db.transaction(async (manager) => {
        const { target, ...item } = body;
        const repositories = buildRepositories(manager);
        const newItem = await shortcutService.postWithOptions(member, repositories, {
          item,
          target,
          previousItemId,
          parentId,
        });
        return newItem as ShortcutItem;
      });

      reply.send(newItem);

      // background operations
      await actionItemService.postPostAction(request, buildRepositories(), newItem);
      await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        await itemService.rescaleOrderForParent(member, repositories, newItem);
      });
    },
  );

  fastify.patch(
    '/shortcuts/:id',
    {
      schema: updateShortcut,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        user,
        body,
        params: { id },
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);

      const item = await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const item = await shortcutService.patch(member, repositories, id, body);
        return item as ShortcutItem;
      });

      reply.send(item);

      // background operations
      await actionItemService.postPostAction(request, buildRepositories(), item);
      await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        await itemService.rescaleOrderForParent(member, repositories, item);
      });
    },
  );
};
