import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ItemService } from '../../item.service';
import { ItemActionService } from '../action/itemAction.service';
import { createShortcut, updateShortcut } from './shortcut.schemas';
import { ShortcutItemService } from './shortcut.service';

export const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const itemService = resolveDependency(ItemService);
  const shortcutService = resolveDependency(ShortcutItemService);
  const itemActionService = resolveDependency(ItemActionService);

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

      const newItem = await db.transaction(async (tx) => {
        const { target, ...item } = body;
        const newItem = await shortcutService.postWithOptions(tx, member, {
          item,
          target,
          previousItemId,
          parentId,
        });
        return newItem;
      });

      reply.send(newItem);

      // background operations
      await itemActionService.postPostAction(db, request, newItem);
      await db.transaction(async (tx) => {
        await itemService.rescaleOrderForParent(tx, member, newItem);
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

      const item = await db.transaction(async (tx) => {
        const item = await shortcutService.patch(tx, member, id, body);
        return item;
      });

      reply.send(item);

      // background operations
      await itemActionService.postPostAction(db, request, item);
      await db.transaction(async (tx) => {
        await itemService.rescaleOrderForParent(tx, member, item);
      });
    },
  );
};
