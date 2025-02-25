import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { asDefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { assertIsMember } from '../../../member/entities/member';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ActionItemService } from '../action/service';
import { createLink, getLinkMetadata, updateLink } from './schemas';
import { EmbeddedLinkItemService } from './service';
import { ensureProtocol } from './utils';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db, log } = fastify;
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

      const item = await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const item = await embeddedLinkService.postWithOptions(member, repositories, {
          ...data,
          previousItemId,
          parentId,
        });
        return item;
      });

      reply.send(item);

      // background operations
      await actionItemService.postPostAction(request, buildRepositories(), item);
      await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        await embeddedLinkService.rescaleOrderForParent(member, repositories, item);
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
      return await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const item = await embeddedLinkService.patchWithOptions(member, repositories, id, body);
        await actionItemService.postPatchAction(request, repositories, item);
        return item;
      });
    },
  );
};

export default plugin;
