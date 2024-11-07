import { fastifyMultipart } from '@fastify/multipart';
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { ItemType } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { FastifyInstanceTypebox } from '../../../../plugins/typebox';
import { asDefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { assertIsMember } from '../../../member/entities/member';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { Item } from '../../entities/Item';
import { getPostItemPayloadFromFormData } from '../../utils';
import { ActionItemService } from '../action/service';
import { createFolder, createFolderWithThumbnail, updateFolder } from './schemas';
import { FolderItemService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;
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

      const item = await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const item = await folderItemService.post(member, repositories, {
          // Because of an incoherence between the service and the schema, we need to cast the data to the correct type
          // This need to be fixed in issue #1288 https://github.com/graasp/graasp/issues/1288
          item: { ...data, type: ItemType.FOLDER } as Partial<Item> & Pick<Item, 'name' | 'type'>,
          previousItemId,
          parentId,
          geolocation: data.geolocation,
        });
        return item;
      });

      reply.send(item);

      // background operations
      await actionItemService.postPostAction(request, buildRepositories(), item);
      await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        await folderItemService.rescaleOrderForParent(member, repositories, item);
      });
    },
  );

  // isolate inside a register because of the multipart
  fastify.register(async (fastify: FastifyInstanceTypebox) => {
    fastify.register(fastifyMultipart, {
      limits: {
        // fieldNameSize: 0,             // Max field name size in bytes (Default: 100 bytes).
        // fieldSize: 1000000,           // Max field value size in bytes (Default: 1MB).
        // fields: 5, // Max number of non-file fields (Default: Infinity).
        fileSize: 1024 * 1024 * 10, // 10Mb For multipart forms, the max file size (Default: Infinity).
        files: 1, // Max number of file fields (Default: Infinity).
        // headerPairs: 2000             // Max number of header key=>value pairs (Default: 2000 - same as node's http).
      },
    });
    fastify.post(
      'folders-with-thumbnail',
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

        return await db.transaction(async (manager) => {
          const repositories = buildRepositories(manager);
          const item = await folderItemService.post(member, repositories, {
            item: itemPayload,
            parentId,
            geolocation,
            thumbnail,
          });
          await actionItemService.postPostAction(request, repositories, item);
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
      return await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const item = await folderItemService.patch(member, repositories, id, body);
        await actionItemService.postPatchAction(request, repositories, item);
        return item;
      });
    },
  );
};

export default plugin;
