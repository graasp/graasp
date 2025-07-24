import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { createPage, pageWebsocketsSchema } from './page.schemas';
import { PageItemService } from './page.service';
import { setupWSConnection } from './setupWSConnection';

export const pageItemPlugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const pageItemService = resolveDependency(PageItemService);
  const authorizedItemService = resolveDependency(AuthorizedItemService);

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

  fastify.get(
    '/pages/ws',
    {
      websocket: true,
      schema: pageWebsocketsSchema,
      preHandler: [
        isAuthenticated,
        matchOne(validatedMemberAccountRole),
        async ({ user, query }) => {
          const account = asDefined(user?.account);

          // check write permission
          await authorizedItemService.assertAccessForItemId(db, {
            permission: PermissionLevel.Write,
            itemId: query.id,
            accountId: account.id,
          });
        },
      ],
    },
    async (client, req) => {
      client.on('error', fastify.log.error);

      setupWSConnection(client, req);
    },
  );
};
