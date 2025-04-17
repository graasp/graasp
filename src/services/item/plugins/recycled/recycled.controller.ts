import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { memberAccountRole } from '../../../member/strategies/memberAccountRole';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ITEMS_PAGE_SIZE } from '../../constants';
import {
  ItemOpFeedbackErrorEvent,
  ItemOpFeedbackEvent,
  memberItemsTopic,
} from '../../ws/item.events';
import { getOwnRecycledItems, recycleMany, restoreMany } from './recycled.schemas';
import { RecycledBinService } from './recycled.service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { websockets } = fastify;

  const recycleBinService = resolveDependency(RecycledBinService);

  // Note: it's okay to not prevent memberships changes on recycled items
  // it is not really possible to change them in the interface
  // but it won't break anything

  // API endpoints

  // get own recycled items data
  fastify.get(
    '/recycled',
    {
      schema: getOwnRecycledItems,
      preHandler: [isAuthenticated, matchOne(memberAccountRole)],
    },
    async ({ user, query }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      const { page = 1, pageSize = ITEMS_PAGE_SIZE } = query;
      const result = await recycleBinService.getOwn(db, member, {
        page,
        pageSize,
      });
      return result;
    },
  );

  // recycle multiple items
  fastify.post(
    '/recycle',
    {
      schema: recycleMany,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        query: { id: ids },
        log,
        user,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);

      reply.status(StatusCodes.ACCEPTED);
      reply.send(ids);

      await db
        .transaction(async (tx) => {
          const items = await recycleBinService.recycleMany(tx, member, ids);
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('recycle', ids, items.data, items.errors),
          );
          return items;
        })
        .catch((e: Error) => {
          log.error(e);
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackErrorEvent('recycle', ids, e),
          );
        });
    },
  );

  // restore multiple items
  fastify.post(
    '/restore',
    {
      schema: restoreMany,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        query: { id: ids },
        log,
        user,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);
      log.info(`Restoring items ${ids}`);

      reply.status(StatusCodes.ACCEPTED);
      reply.send(ids);

      await db
        .transaction(async (tx) => {
          return await recycleBinService.restoreMany(tx, member, ids);
        })
        .then((items) => {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('restore', ids, Object.fromEntries(items.map((i) => [i.id, i]))),
          );
        })
        .catch((e: Error) => {
          log.error(e);
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackErrorEvent('restore', ids, e),
          );
        });
    },
  );
};

export default plugin;
