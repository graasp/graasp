import { fastifyMultipart } from '@fastify/multipart';
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { FastifyInstanceTypebox } from '../../../../plugins/typebox';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { getPostItemPayloadFromFormData } from '../../utils';
import { ActionItemService } from '../action/action.service';
import { createFolder, createFolderWithThumbnail, updateFolder } from './schemas';
import { FolderItemService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const folderItemService = resolveDependency(FolderItemService);
  const actionItemService = resolveDependency(ActionItemService);

  fastify.post(
    '/folders',
    {
      schema: createFolder,
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
        const item = await folderItemService.postWithOptions(tx, member, {
          // Because of an incoherence between the service and the schema, we need to cast the data to the correct type
          // This need to be fixed in issue #1288 https://github.com/graasp/graasp/issues/1288
          item: data,
          previousItemId,
          parentId,
          geolocation: data.geolocation,
        });
        return item;
      });

      reply.send(item);

      // background operations
      await actionItemService.postPostAction(db, request, item);
      await db.transaction(async (tx) => {
        await folderItemService.rescaleOrderForParent(tx, member, item);
      });
    },
  );

  // isolate inside a register because of the multipart
  fastify.register(async (fastify: FastifyInstanceTypebox) => {
    fastify.register(fastifyMultipart, {
      limits: {
        fileSize: 1024 * 1024 * 10, // 10Mb For multipart forms, the max file size (Default: Infinity).
        files: 1, // Max number of file fields (Default: Infinity).
      },
    });
    fastify.post(
      '/folders-with-thumbnail',
      {
        schema: createFolderWithThumbnail,
        preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
      },
      async (request) => {
        const {
          user,
          query: { parentId },
        } = request;
        const member = asDefined(user?.account);
        assertIsMember(member);

        // get the formData from the request
        const formData = await request.file();
        const {
          item: itemPayload,
          geolocation,
          thumbnail,
        } = getPostItemPayloadFromFormData(formData);

        return await db.transaction(async (tx) => {
          const item = await folderItemService.postWithOptions(tx, member, {
            item: itemPayload,
            parentId,
            geolocation,
            thumbnail,
          });
          await actionItemService.postPostAction(tx, request, item);
          return item;
        });
      },
    );
  });

  fastify.patch(
    '/folders/:id',
    {
      schema: updateFolder,
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
        const item = await folderItemService.patch(tx, member, id, body);
        await actionItemService.postPatchAction(tx, request, item);
        return item;
      });
    },
  );
};

export default plugin;
