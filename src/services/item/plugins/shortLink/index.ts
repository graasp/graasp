import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { FastifyInstanceTypebox } from '../../../../plugins/typebox.js';
import { asDefined } from '../../../../utils/assertions.js';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport/index.js';
import { assertIsMember } from '../../../authentication.js';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole.js';
import {
  createShortLink,
  deleteShortLink,
  getAllByItem,
  getAvailable,
  getRedirection,
  updateShortLink,
} from './schemas.js';
import { SHORT_LINKS_LIST_ROUTE, ShortLinkService } from './service.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const shortLinkService = resolveDependency(ShortLinkService);

  fastify.register(async function (fastify: FastifyInstanceTypebox) {
    // No need to be logged for the redirection
    fastify.get('/:alias', { schema: getRedirection }, async ({ params: { alias } }, reply) => {
      const path = await shortLinkService.getRedirection(db, alias);
      reply.code(StatusCodes.MOVED_TEMPORARILY).redirect(path);
    });

    fastify.get('/available/:alias', { schema: getAvailable }, async ({ params: { alias } }) => {
      try {
        await shortLinkService.getOne(db, alias);
        return { available: false };
      } catch (e) {
        return { available: true };
      }
    });

    // Only the admin can manage a short link of this resource
    await fastify.register(async (fastify: FastifyInstanceTypebox) => {
      fastify.get(
        `${SHORT_LINKS_LIST_ROUTE}/:itemId`,
        { schema: getAllByItem, preHandler: isAuthenticated },
        async ({ user, params: { itemId } }) => {
          const member = asDefined(user?.account);
          return shortLinkService.getAllForItem(db, member, itemId);
        },
      );

      fastify.post(
        '/',
        {
          schema: createShortLink,
          preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
        },
        async ({ user, body: shortLink }) => {
          const member = asDefined(user?.account);
          assertIsMember(member);
          return db.transaction(async (tx) => {
            const newLink = await shortLinkService.post(tx, member, shortLink);
            return newLink;
          });
        },
      );

      fastify.delete(
        '/:alias',
        {
          schema: deleteShortLink,
          preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
        },
        async ({ user, params: { alias } }) => {
          const member = asDefined(user?.account);
          assertIsMember(member);
          return db.transaction(async (tx) => {
            const oldLink = await shortLinkService.delete(tx, member, alias);
            return oldLink;
          });
        },
      );

      fastify.patch(
        '/:alias',
        {
          schema: updateShortLink,
          preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
        },
        async ({ user, body: shortLink, params: { alias } }) => {
          const member = asDefined(user?.account);
          assertIsMember(member);
          return db.transaction(async (tx) => {
            const updatedLink = await shortLinkService.update(tx, member, alias, shortLink);
            return updatedLink;
          });
        },
      );
    });
  });
};

export default plugin;
