import { StatusCodes } from 'http-status-codes';

import { fastifyMultipart } from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';

import { ItemTagType, Pagination, PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../di/utils';
import { IdParam, IdsParams } from '../../types';
import { asDefined } from '../../utils/assertions';
import { buildRepositories } from '../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../auth/plugins/passport';
import { matchOne } from '../authorization';
import { assertIsMember } from '../member/entities/member';
import { memberAccountRole } from '../member/strategies/memberAccountRole';
import { validatedMemberAccountRole } from '../member/strategies/validatedMemberAccountRole';
import { resultOfToList } from '../utils';
import { ITEMS_PAGE_SIZE } from './constants';
import { Item } from './entities/Item';
import {
  SHOW_HIDDEN_PARRAM,
  TYPES_FILTER_PARAM,
  copyMany,
  deleteMany,
  getAccessible,
  getChildren,
  getDescendants,
  getMany,
  getOne,
  getOwn,
  getParents,
  getShared,
  moveMany,
  reorder,
  updateMany,
} from './fluent-schema';
import { ActionItemService } from './plugins/action/service';
import { ItemGeolocation } from './plugins/geolocation/ItemGeolocation';
import { ItemService } from './service';
import { ItemChildrenParams, ItemSearchParams } from './types';
import { getPostItemPayloadFromFormData } from './utils';
import { ItemOpFeedbackErrorEvent, ItemOpFeedbackEvent, memberItemsTopic } from './ws/events';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, items, websockets } = fastify;
  const itemService = resolveDependency(ItemService);
  const actionItemService = resolveDependency(ActionItemService);

  // create item
  // question: add link hook here? or have another endpoint?
  fastify.post<{
    Querystring: {
      parentId?: string;
      previousItemId?: string;
    };
    Body: Partial<Item> & Pick<Item, 'name' | 'type'> & Pick<ItemGeolocation, 'lat' | 'lng'>;
  }>(
    '/',
    {
      schema: items.extendCreateSchema(),
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
        const item = await itemService.post(member, repositories, {
          item: data,
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
        await itemService.rescaleOrderForParent(member, repositories, item);
      });
    },
  );

  // isolate inside a register because of the mutlipart
  fastify.register(async (fastify) => {
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
    fastify.post<{
      Querystring: {
        parentId?: string;
      };
    }>(
      '/with-thumbnail',
      {
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
          const item = await itemService.post(member, repositories, {
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

  // get item
  fastify.get<{ Params: IdParam }>(
    '/:id',
    {
      schema: getOne,
      preHandler: optionalIsAuthenticated,
    },
    async ({ user, params: { id } }) => {
      const item = await itemService.getPacked(user?.account, buildRepositories(), id);
      return item;
    },
  );

  fastify.get<{ Querystring: IdsParams }>(
    '/',
    { schema: getMany, preHandler: optionalIsAuthenticated },
    async ({ user, query: { id: ids } }) => {
      return itemService.getManyPacked(user?.account, buildRepositories(), ids);
    },
  );

  // returns items you have access to given the parameters
  fastify.get<{
    Querystring: ItemSearchParams & Partial<Pagination>;
  }>(
    '/accessible',
    { schema: getAccessible, preHandler: [isAuthenticated, matchOne(memberAccountRole)] },
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
      return itemService.getAccessible(
        member,
        buildRepositories(),
        { creatorId, keywords, sortBy, ordering, permissions, types },
        { page, pageSize },
      );
    },
  );

  // get own
  fastify.get(
    '/own',
    { schema: getOwn, preHandler: [isAuthenticated, matchOne(memberAccountRole)] },
    async ({ user }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return itemService.getOwn(member, buildRepositories());
    },
  );

  // get shared with
  fastify.get<{ Querystring: { permission?: PermissionLevel } }>(
    '/shared-with',
    {
      schema: getShared,
      preHandler: [isAuthenticated, matchOne(memberAccountRole)],
    },
    async ({ user, query }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return itemService.getShared(member, buildRepositories(), query.permission);
    },
  );

  // get item's children
  fastify.get<{ Params: IdParam; Querystring: ItemChildrenParams }>(
    '/:id/children',
    { schema: getChildren, preHandler: optionalIsAuthenticated },
    async ({ user, params: { id }, query: { ordered, types, keywords } }) => {
      return itemService.getPackedChildren(user?.account, buildRepositories(), id, {
        ordered,
        types,
        keywords,
      });
    },
  );

  // get item's descendants
  fastify.get<{
    Params: IdParam;
    Querystring: { [SHOW_HIDDEN_PARRAM]?: boolean; [TYPES_FILTER_PARAM]?: ItemTagType[] };
  }>(
    '/:id/descendants',
    { schema: getDescendants, preHandler: optionalIsAuthenticated },
    async ({ user, params: { id }, query }) => {
      return itemService.getPackedDescendants(user?.account, buildRepositories(), id, query);
    },
  );

  // get item's parents
  fastify.get<{ Params: IdParam }>(
    '/:id/parents',
    {
      schema: getParents,
      preHandler: optionalIsAuthenticated,
    },
    async ({ user, params: { id } }) => {
      return itemService.getParents(user?.account, buildRepositories(), id);
    },
  );

  // update item
  fastify.patch<{ Params: IdParam; Body: Partial<Item> }>(
    '/:id',
    {
      schema: items.extendExtrasUpdateSchema(),
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
        const item = await itemService.patch(member, repositories, id, body);
        await actionItemService.postPatchAction(request, repositories, item);
        return item;
      });
    },
  );

  fastify.patch<{ Querystring: IdsParams; Body: Partial<Item> }>(
    '/',
    {
      schema: updateMany(items.extendExtrasUpdateSchema()),
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        user,
        query: { id: ids },
        body,
        log,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);
      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const items = await itemService.patchMany(member, repositories, ids, body);
        await actionItemService.postManyPatchAction(
          request,

          repositories,
          resultOfToList(items),
        );
        return items;
      })
        .then((items) => {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('update', ids, items.data, items.errors),
          );
        })
        .catch((e: Error) => {
          log.error(e);
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackErrorEvent('update', ids, e),
          );
        });
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );

  fastify.patch<{ Params: { id: string }; Body: { previousItemId?: string } }>(
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

      const item = await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        return itemService.reorder(member, repositories, id, body);
      });

      reply.send(item);

      // background operation, no need to await
      await db.transaction(async (manager) => {
        await itemService.rescaleOrderForParent(member, buildRepositories(manager), item);
      });
    },
  );

  fastify.delete<{ Querystring: IdsParams }>(
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
      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const items = await itemService.deleteMany(member, repositories, ids);
        await actionItemService.postManyDeleteAction(request, repositories, items);
        return items;
      })
        .then((items) => {
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
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );

  fastify.post<{
    Querystring: IdsParams;
    Body: {
      parentId?: string;
    };
  }>(
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
      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const results = await itemService.moveMany(member, repositories, ids, parentId);
        await actionItemService.postManyMoveAction(request, repositories, results.items);
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
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );

  fastify.post<{
    Querystring: IdsParams;
    Body: { parentId: string };
  }>(
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
      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        return await itemService.copyMany(member, repositories, ids, {
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
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );
};

export default plugin;
