import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ItemActionService } from '../action/itemAction.service';
import { createLink, getLinkMetadata, updateLink } from './link.schemas';
import { EmbeddedLinkItemService } from './link.service';
import { ensureProtocol } from './utils';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { log } = fastify;
  const embeddedLinkService = resolveDependency(EmbeddedLinkItemService);
  const itemActionService = resolveDependency(ItemActionService);

  fastify.get(
    '/metadata',
    { schema: getLinkMetadata, preHandler: isAuthenticated },
    async ({ query: { link } }) => {
      const url = ensureProtocol(link);
      const metadata = await embeddedLinkService.getLinkMetadata(url);
      const isEmbeddingAllowed = await embeddedLinkService.checkEmbeddingAllowed(url, log);

      return {
        ...metadata,
        isEmbeddingAllowed,
      };
    },
  );

  fastify.post(
    '/',
    {
      schema: createLink,
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
        const item = await embeddedLinkService.postWithOptions(tx, member, {
          ...data,
          previousItemId,
          parentId,
        });
        return item;
      });

      reply.send(item);

      // background operations
      await itemActionService.postPostAction(db, request, item);
      await db.transaction(async (tx) => {
        await embeddedLinkService.rescaleOrderForParent(tx, member, item);
      });
    },
  );

  fastify.patch(
    '/:id',
    {
      schema: updateLink,
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
      return await db.transaction(async (tx) => {
        const item = await embeddedLinkService.patchWithOptions(tx, member, id, body);

        await itemActionService.postPatchAction(tx, request, item);
        return item;
      });
    },
  );
};

export default plugin;
