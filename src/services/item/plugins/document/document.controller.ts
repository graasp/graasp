import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ActionItemService } from '../action/itemAction.service';
import { createDocument, updateDocument } from './document.schemas';
import { DocumentItemService } from './document.service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const documentService = resolveDependency(DocumentItemService);
  const actionItemService = resolveDependency(ActionItemService);

  fastify.post(
    '/',
    {
      schema: createDocument,
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
        const item = await documentService.postWithOptions(tx, member, {
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
        await documentService.rescaleOrderForParent(tx, member, item);
      });
    },
  );

  fastify.patch(
    '/:id',
    {
      schema: updateDocument,
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
        const item = await documentService.patchWithOptions(tx, member, id, body);
        await actionItemService.postPatchAction(tx, request, item);
        return item;
      });
    },
  );
};

export default plugin;
