import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ItemType, PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { WrongItemTypeError } from '../../errors';
import { createPage, pageWebsocketsSchema } from './page.schemas';
import { PageItemService } from './page.service';
import { setupWSConnectionForRead, setupWSConnectionForWriters } from './setupWSConnection';

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
    '/pages/:id/ws/read',
    {
      websocket: true,
      schema: pageWebsocketsSchema,
      preHandler: [
        optionalIsAuthenticated,
        async ({ user, params }) => {
          const item = await authorizedItemService.getItemById(db, {
            itemId: params.id,
            accountId: user?.account?.id,
          });
          // item should be a page
          if (item.type !== ItemType.PAGE) {
            throw new WrongItemTypeError(item.type);
          }
        },
      ],
    },
    async (client, req) => {
      client.on('error', fastify.log.error);
      setupWSConnectionForRead(client, req.params.id);
    },
  );

  fastify.get(
    '/pages/:id/ws',
    {
      websocket: true,
      schema: pageWebsocketsSchema,
      preHandler: [
        isAuthenticated,
        matchOne(validatedMemberAccountRole),
        async ({ user, params }) => {
          const account = asDefined(user?.account);
          // check write permission
          const item = await authorizedItemService.getItemById(db, {
            permission: PermissionLevel.Write,
            itemId: params.id,
            accountId: account.id,
          });
          // item should be a page
          if (item.type !== ItemType.PAGE) {
            throw new WrongItemTypeError(item.type);
          }
        },
      ],
    },
    async (client, req) => {
      client.on('error', fastify.log.error);
      setupWSConnectionForWriters(client, req.params.id);
    },
  );
};
