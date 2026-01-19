import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ItemActionService } from '../action/itemAction.service';
import { FolderItemService } from '../folder/folder.service';
import { convertCapsuleToFolder, createCapsule } from './capsule.schemas';
import { CapsuleItemService } from './capsule.service';

export const capsulePlugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const folderItemService = resolveDependency(FolderItemService);
  const capsuleItemService = resolveDependency(CapsuleItemService);
  const itemActionService = resolveDependency(ItemActionService);

  fastify.post(
    '/capsules',
    {
      schema: createCapsule,
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
        const item = await capsuleItemService.create(tx, member, {
          item: data,
          previousItemId,
          parentId,
        });
        return item;
      });

      reply.send(item);

      // background operations
      await itemActionService.postPostAction(db, request, item);
      await db.transaction(async (tx) => {
        await folderItemService.rescaleOrderForParent(tx, member, item);
      });
    },
  );

  fastify.post(
    '/capsules/:id/convert',
    {
      schema: convertCapsuleToFolder,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request) => {
      const {
        user,
        params: { id },
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);
      return await db.transaction(async (tx) => {
        const item = await capsuleItemService.convertToFolder(tx, member, id);
        return item;
      });
    },
  );
};
