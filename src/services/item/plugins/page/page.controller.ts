import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { createPage } from './page.schemas';
import { PageItemService } from './page.service';

export const pageItemPlugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const pageItemService = resolveDependency(PageItemService);

  fastify.post(
    '/pages',
    {
      schema: createPage,
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
        return await pageItemService.create(tx, member, {
          item: data,
          previousItemId,
          parentId,
          geolocation: data.geolocation,
        });
      });

      reply.code(StatusCodes.CREATED);
      reply.send(item);
    },
  );
};
