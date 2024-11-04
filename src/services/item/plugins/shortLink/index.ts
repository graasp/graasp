import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { FastifyInstanceTypebox } from '../../../../plugins/typebox';
import { asDefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { assertIsMember } from '../../../member/entities/member';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import {
  createShortLink,
  deleteShortLink,
  getAllByItem,
  getAvailable,
  getRedirection,
  updateShortLink,
} from './schemas';
import { SHORT_LINKS_LIST_ROUTE, ShortLinkService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;
  const shortLinkService = resolveDependency(ShortLinkService);

  fastify.register(async function (fastify: FastifyInstanceTypebox) {
    // No need to be logged for the redirection
    fastify.get('/:alias', { schema: getRedirection }, async ({ params: { alias } }, reply) => {
      const path = await shortLinkService.getRedirection(buildRepositories(), alias);
      reply.code(StatusCodes.MOVED_TEMPORARILY).redirect(path);
    });

    fastify.get('/available/:alias', { schema: getAvailable }, async ({ params: { alias } }) => {
      try {
        await shortLinkService.getOne(buildRepositories(), alias);
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
          return shortLinkService.getAllForItem(member, buildRepositories(), itemId);
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
          return db.transaction(async (manager) => {
            const newLink = await shortLinkService.post(
              member,
              buildRepositories(manager),
              shortLink,
            );
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
          return db.transaction(async (manager) => {
            const oldLink = await shortLinkService.delete(
              member,
              buildRepositories(manager),
              alias,
            );
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
          return db.transaction(async (manager) => {
            const updatedLink = await shortLinkService.update(
              member,
              buildRepositories(manager),
              alias,
              shortLink,
            );
            return updatedLink;
          });
        },
      );
    });
  });
};

export default plugin;
