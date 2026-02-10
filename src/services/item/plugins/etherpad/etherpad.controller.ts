import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport';
import { assertIsMember, assertIsMemberOrGuest } from '../../../authentication';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ItemService } from '../../item.service';
import { createEtherpad, getEtherpadFromItem, updateEtherpad } from './etherpad.schemas';
import { EtherpadItemService } from './etherpad.service';

const endpoints: FastifyPluginAsyncTypebox = async (fastify) => {
  const itemService = resolveDependency(ItemService);
  const etherpadItemService = resolveDependency(EtherpadItemService);

  /**
   * Etherpad creation
   */
  fastify.post(
    '/create',
    {
      schema: createEtherpad,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        user,
        body,
        query: { parentId },
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);

      await db.transaction(async (tx) => {
        await etherpadItemService.createEtherpadItem(tx, member, body, parentId);
      });

      reply.status(StatusCodes.NO_CONTENT);
    },
  );

  /**
   * Etherpad update
   */
  fastify.patch(
    '/:id',
    {
      schema: updateEtherpad,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        user,
        params: { id },
        body,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);

      await db.transaction(async (tx) => {
        return await etherpadItemService.patchWithOptions(tx, member, id, body);
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );

  /**
   * Etherpad view in given mode (read or write)
   * Access should be granted if and only if the user has at least write access to the item.
   * If user only has read permission, then the pad should be displayed in read-only mode.
   */
  fastify.get(
    '/view/:itemId',
    { schema: getEtherpadFromItem, preHandler: isAuthenticated },
    async (request, reply) => {
      const {
        user,
        params: { itemId },
        query: { mode = 'read' },
      } = request;
      const account = asDefined(user?.account);
      assertIsMemberOrGuest(account);

      const { cookie, padUrl } = await etherpadItemService.getEtherpadFromItem(
        db,
        account,
        itemId,
        mode,
      );

      reply.setCookie(cookie.name, cookie.value, cookie.options);
      return { padUrl };
    },
  );

  /**
   * Delete etherpad on item delete
   */
  itemService.hooks.setPreHook('delete', async (actor, _db, { item }) => {
    if (!actor) {
      return;
    }
    await etherpadItemService.deleteEtherpadForItem(item);
  });

  /**
   * Copy etherpad on item copy
   */
  itemService.hooks.setPreHook('copy', async (actor, _db, { original: item }) => {
    if (!actor) {
      return;
    }
    await etherpadItemService.copyEtherpadInMutableItem(item);
  });
};

const plugin: FastifyPluginAsync = async (fastify) => {
  // create a route prefix for etherpad
  await fastify.register(endpoints, { prefix: 'etherpad' });
};

export default fp(plugin, {
  name: 'graasp-plugin-etherpad',
});
