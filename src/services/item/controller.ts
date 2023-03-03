import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { IdParam, IdsParams, ParentIdParam, PermissionLevel } from '@graasp/sdk';

import { buildRepositories } from '../../util/repositories';
import { Item } from './entities/Item';
import {
  copyMany,
  copyOne,
  deleteMany,
  deleteOne,
  getChildren,
  getDescendants,
  getMany,
  getOne,
  getOwn,
  getShared,
  moveMany,
  moveOne,
  updateMany,
} from './fluent-schema';
// import { itemActionHandler } from './handler/item-action-handler';
import { Ordered } from './interfaces/requests';

// import { registerItemWsHooks } from './ws/hooks';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, items } = fastify;
  const itemService = items.service;

  // create item
  // question: add link hook here? or have another endpoint?
  fastify.post<{ Querystring: ParentIdParam; Body: Partial<Item> }>(
    '/',
    {
      schema: items.extendCreateSchema(),
    },
    async ({ member, query: { parentId }, body: data, log }) => {
      return db.transaction(async (manager) => {
        return itemService.create(member, buildRepositories(manager), {
          item: data,
          parentId,
          creator: member,
        });
      });
    },
  );

  // get item
  fastify.get<{ Params: IdParam }>(
    '/:id',
    {
      schema: getOne,
    },
    async ({ member, params: { id }, log }) => {
      return itemService.get(member, buildRepositories(), id);
    },
  );

  fastify.get<{ Querystring: IdsParams }>(
    '/',
    { schema: getMany },
    async ({ member, query: { id: ids }, log }) => {
      return itemService.getMany(member, buildRepositories(), ids);
    },
  );

  // get own
  fastify.get('/own', { schema: getOwn }, async ({ member, log }) => {
    return itemService.getOwn(member, buildRepositories());
  });

  // get shared with
  fastify.get<{ Querystring: { permission?: PermissionLevel } }>(
    '/shared-with',
    {
      schema: getShared,
    },
    async ({ member, log, query }) => {
      return itemService.getShared(member, buildRepositories(), query.permission);
    },
  );

  // get item's children
  fastify.get<{ Params: IdParam; Querystring: Ordered }>(
    '/:id/children',
    { schema: getChildren },
    async ({ member, params: { id }, query: { ordered }, log }) => {
      return itemService.getChildren(member, buildRepositories(), id, ordered);
    },
  );

  // get item's descendants
  fastify.get<{ Params: IdParam }>(
    '/:id/descendants',
    { schema: getDescendants },
    async ({ member, params: { id }, log }) => {
      return itemService.getDescendants(member, buildRepositories(), id);
    },
  );

  // get item's parents
  fastify.get<{ Params: IdParam }>(
    '/:id/parents',
    {
      // schema: getDescendants
    },
    async ({ member, params: { id }, log }) => {
      return itemService.getParents(member, buildRepositories(), id);
    },
  );

  // update items
  fastify.patch<{ Params: IdParam; Body: Partial<Item> }>(
    '/:id',
    { schema: items.extendExtrasUpdateSchema() },
    async ({ member, params: { id }, body, log }) => {
      return db.transaction((manager) => {
        return itemService.patch(member, buildRepositories(manager), id, body);
      });
    },
  );

  fastify.patch<{ Querystring: IdsParams; Body: Partial<Item> }>(
    '/',
    { schema: updateMany(items.extendExtrasUpdateSchema()) },
    async ({ member, query: { id: ids }, body, log }, reply) => {
      db.transaction((manager) => {
        // TODO: implement queue
        return itemService.patchMany(member, buildRepositories(manager), ids, body);
      }).catch((e) => {
        // TODO: return feedback in queue
        console.error(e);
      });
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );

  // delete item
  fastify.delete<{ Params: IdParam }>(
    '/:id',
    { schema: deleteOne },
    async ({ member, params: { id }, log }, reply) => {
      db.transaction((manager) => {
        // TODO: implement queue
        return itemService.delete(member, buildRepositories(manager), id);
      }).catch((e) => {
        // TODO: return feedback in queue
        console.error(e);
      });
      reply.status(StatusCodes.ACCEPTED);
      return id;
    },
  );

  fastify.delete<{ Querystring: IdsParams }>(
    '/',
    {
      schema: deleteMany,
    },
    async ({ member, query: { id: ids }, log }, reply) => {
      db.transaction((manager) => {
        // TODO: implement queue
        return itemService.deleteMany(member, buildRepositories(manager), ids);
      }).catch((e) => {
        // TODO: return feedback in queue
        console.error(e);
      });
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );

  // move item
  fastify.post<{ Params: IdParam; Body: ParentIdParam }>(
    '/:id/move',
    { schema: moveOne },
    async ({ member, params: { id }, body: { parentId }, log }, reply) => {
      // TODO: implement queue
      db.transaction(async (manager) => {
        return itemService.move(member, buildRepositories(manager), id, parentId);
      }).catch((e) => {
        // TODO: return feedback in queue
        console.error(e);
      });
      reply.status(StatusCodes.ACCEPTED);
      return id;
    },
  );

  fastify.post<{ Querystring: IdsParams; Body: ParentIdParam }>(
    '/move',
    { schema: moveMany },
    async ({ member, query: { id: ids }, body: { parentId }, log }, reply) => {
      // TODO: implement queue
      db.transaction(async (manager) => {
        return itemService.moveMany(member, buildRepositories(manager), ids, parentId);
      }).catch((e) => {
        // TODO: return feedback in queue
        console.error(e);
      });
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );

  // copy item
  fastify.post<{ Params: IdParam; Body: { parentId: string } }>(
    '/:id/copy',
    { schema: copyOne },
    async ({ member, params: { id }, body: { parentId }, log }, reply) => {
      // TODO: implement queue
      db.transaction(async (manager) => {
        return itemService.copy(member, buildRepositories(manager), id, {
          parentId,
        });
      }).catch((e) => {
        // TODO: return feedback in queue
        console.error(e);
      });
      reply.status(StatusCodes.ACCEPTED);
      return id;
    },
  );

  fastify.post<{
    Querystring: IdsParams;
    Body: { parentId: string };
  }>(
    '/copy',
    { schema: copyMany },
    async ({ member, query: { id: ids }, body: { parentId }, log }, reply) => {
      // TODO: implement queue
      db.transaction(async (manager) => {
        return itemService.copyMany(member, buildRepositories(manager), ids, {
          parentId,
        });
      }).catch((e) => {
        // TODO: return feedback in queue
        console.error(e);
      });
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );
};

export default plugin;
