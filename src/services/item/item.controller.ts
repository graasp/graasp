import { StatusCodes } from 'http-status-codes';

import { fastifyMultipart } from '@fastify/multipart';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../di/utils';
import { db } from '../../drizzle/db';
import type { FastifyInstanceTypebox } from '../../plugins/typebox';
import { asDefined } from '../../utils/assertions';
import { isAuthenticated, matchOne, optionalIsAuthenticated } from '../auth/plugins/passport';
import { assertIsMember } from '../authentication';
import { memberAccountRole } from '../member/strategies/memberAccountRole';
import { validatedMemberAccountRole } from '../member/strategies/validatedMemberAccountRole';
import { ITEMS_PAGE_SIZE } from './constants';
import type { ItemRaw } from './item';
import { copyMany, deleteMany, getParentItems, moveMany, reorder, updateOne } from './item.schemas';
import { create, createWithThumbnail } from './item.schemas.create';
import { getAccessible, getChildren, getDescendantItems, getOne } from './item.schemas.packed';
import { ItemService } from './item.service';
import { PackedItemService } from './packedItem.dto';
import { ItemActionService } from './plugins/action/itemAction.service';
import { getPostItemPayloadFromFormData } from './utils';
import { ItemOpFeedbackErrorEvent, ItemOpFeedbackEvent, memberItemsTopic } from './ws/item.events';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { websockets } = fastify;

  const itemService = resolveDependency(ItemService);
  const itemActionService = resolveDependency(ItemActionService);
  const itemWrapperService = resolveDependency(PackedItemService);

  // create item
  // question: add link hook here? or have another endpoint?
  fastify.post(
    '/',
    {
      schema: create,
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

      const item = await db.transaction(async (tsx) => {
        const item = await itemService.post(tsx, member, {
          // Because of an incoherence between the service and the schema, we need to cast the data to the correct type
          // This need to be fixed in issue #1288 https://github.com/graasp/graasp/issues/1288
          item: data as Partial<ItemRaw> & Pick<ItemRaw, 'name' | 'type'>,
          previousItemId,
          parentId,
          geolocation: data.geolocation,
        });
        return item;
      });

      reply.send(item);

      // background operations
      await db.transaction(async (tsx) => {
        await itemService.rescaleOrderForParent(tsx, member, item);
      });
      await itemActionService.postPostAction(db, request, item);
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
    // create folder element with thumbnail
    fastify.post(
      '/with-thumbnail',
      {
        schema: createWithThumbnail,
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

        return await db.transaction(async (tsx) => {
          const item = await itemService.post(tsx, member, {
            item: itemPayload,
            parentId,
            geolocation,
            thumbnail,
          });
          await itemActionService.postPostAction(tsx, request, item);
          return item;
        });
      },
    );
  });

  // get item
  fastify.get(
    '/:id',
    {
      schema: getOne,
      preHandler: optionalIsAuthenticated,
    },
    async ({ user, params: { id } }) => {
      return itemService.getPacked(db, user?.account, id);
    },
  );

  // returns items you have access to given the parameters
  fastify.get(
    '/accessible',
    {
      schema: getAccessible,
      preHandler: [isAuthenticated, matchOne(memberAccountRole)],
    },
    async ({ user, query }) => {
      const {
        page = 1,
        pageSize = ITEMS_PAGE_SIZE,
        creatorId,
        keywords,
        sortBy,
        ordering,
        permissions,
        types,
      } = query;
      const member = asDefined(user?.account);
      assertIsMember(member);

      const result = await itemService.getAccessible(
        db,
        member,
        { creatorId, keywords, sortBy, ordering, permissions, types },
        { page, pageSize },
      );

      // remap to discriminated packed items
      const packedItems = await itemWrapperService.createPackedItems(db, result.data);
      return { ...result, data: packedItems };
    },
  );

  // get item's children
  fastify.get(
    '/:id/children',
    { schema: getChildren, preHandler: optionalIsAuthenticated },
    async ({ user, params: { id }, query: { types, keywords } }) => {
      return itemService.getPackedChildren(db, user?.account, id, {
        types,
        keywords,
      });
    },
  );

  // get item's descendants
  fastify.get(
    '/:id/descendants',
    { schema: getDescendantItems, preHandler: optionalIsAuthenticated },
    async ({ user, params: { id }, query }) => {
      const result = await itemService.getPackedDescendants(db, user?.account, id, query);
      return result;
    },
  );

  // get item's parents
  fastify.get(
    '/:id/parents',
    {
      schema: getParentItems,
      preHandler: optionalIsAuthenticated,
    },
    async ({ user, params: { id } }) => {
      return itemService.getParents(db, user?.account, id);
    },
  );

  // update item
  fastify.patch(
    '/:id',
    {
      schema: updateOne,
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
      return await db.transaction(async (tsx) => {
        const item = await itemService.patch(tsx, member, id, body);
        await itemActionService.postPatchAction(tsx, request, item);
        return item;
      });
    },
  );

  fastify.patch(
    '/:id/reorder',
    {
      schema: reorder,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        user,
        params: { id },
        body,
      } = request;

      const member = asDefined(user?.account);
      assertIsMember(member);

      const item = await db.transaction(async (tsx) => {
        return itemService.reorder(tsx, member, id, body);
      });

      reply.send(item);

      // background operation, no need to await
      await db.transaction(async (tsx) => {
        await itemService.rescaleOrderForParent(tsx, member, item);
      });
    },
  );

  fastify.delete(
    '/',
    {
      schema: deleteMany,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        user,
        query: { id: ids },
        log,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);

      reply.status(StatusCodes.ACCEPTED);
      reply.send(ids);

      await db
        .transaction(async (tsx) => {
          const items = await itemService.deleteMany(tsx, member, ids);
          return items;
        })
        .then(async (items) => {
          await itemActionService.postManyDeleteAction(db, request, items);
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('delete', ids, Object.fromEntries(items.map((i) => [i.id, i]))),
          );
        })
        .catch((e) => {
          log.error(e);
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackErrorEvent('delete', ids, e),
          );
        });
    },
  );

  fastify.post(
    '/move',
    {
      schema: moveMany,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        user,
        query: { id: ids },
        body: { parentId },
        log,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);

      reply.status(StatusCodes.ACCEPTED);
      reply.send(ids);

      await db
        .transaction(async (tsx) => {
          const results = await itemService.moveMany(tsx, member, ids, parentId);
          await itemActionService.postManyMoveAction(tsx, request, results.items);
          return results;
        })
        .then(({ items, moved }) => {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('move', ids, { items, moved }),
          );
        })
        .catch((e) => {
          log.error(e);
          websockets.publish(memberItemsTopic, member.id, ItemOpFeedbackErrorEvent('move', ids, e));
        });
    },
  );

  fastify.post(
    '/copy',
    {
      schema: copyMany,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        user,
        query: { id: ids },
        body: { parentId },
        log,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);

      reply.status(StatusCodes.ACCEPTED);
      reply.send(ids);

      await db
        .transaction(async (tsx) => {
          return await itemService.copyMany(tsx, member, ids, {
            parentId,
          });
        })
        .then(({ items, copies }) => {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('copy', ids, { items, copies }),
          );
        })
        .catch((e) => {
          log.error(e);
          websockets.publish(memberItemsTopic, member.id, ItemOpFeedbackErrorEvent('copy', ids, e));
        });
    },
  );
};

export default plugin;
