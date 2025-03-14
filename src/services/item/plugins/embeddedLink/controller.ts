import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { asDefined } from '../../../../utils/assertions.js';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport/index.js';
import { assertIsMember } from '../../../authentication.js';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole.js';
import { ActionItemService } from '../action/action.service.js';
import { createLink, getLinkMetadata, updateLink } from './schemas.js';
import { EmbeddedLinkItemService } from './service.js';
import { ensureProtocol } from './utils.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { log } = fastify;
  const embeddedLinkService = resolveDependency(EmbeddedLinkItemService);
  const actionItemService = resolveDependency(ActionItemService);

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
      await actionItemService.postPostAction(db, request, item);
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
        await actionItemService.postPatchAction(tx, request, item);
        return item;
      });
    },
  );
};

export default plugin;
