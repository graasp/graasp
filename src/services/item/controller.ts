import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { IdParam, IdsParams, ParentIdParam, PermissionLevel } from '@graasp/sdk';

import { buildRepositories } from '../../utils/repositories';
import { resultOfToList } from '../utils';
import { Item } from './entities/Item';
import {
  copyMany,
  deleteMany,
  getChildren,
  getDescendants,
  getMany,
  getOne,
  getOwn,
  getParents,
  getShared,
  moveMany,
  updateMany,
} from './fluent-schema';
import { Ordered } from './interfaces/requests';

// import { registerItemWsHooks } from './ws/hooks';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    db,
    items,
  } = fastify;
  const itemService = items.service;
  const actionItemService = items.actions.service;

  // create item
  // question: add link hook here? or have another endpoint?
  fastify.post<{ Querystring: ParentIdParam; Body: Partial<Item> }>(
    '/',
    {
      schema: items.extendCreateSchema(),
      preHandler: fastify.verifyAuthentication,
    },
    async (request, reply) => {
      const {
        member,
        query: { parentId },
        body: data,
        log,
      } = request;
      const item = await db.transaction(async (manager) => {
        return itemService.post(member, buildRepositories(manager), {
          item: data,
          parentId,
        });
      });
      actionItemService.postPostAction(request, reply, item);
      return item;
    },
  );

  // get item
  fastify.get<{ Params: IdParam }>(
    '/:id',
    {
      schema: getOne,
      preHandler: fastify.fetchMemberInSession,
    },
    async ({ member, params: { id }, log }) => {
      return itemService.get(member, buildRepositories(), id);
    },
  );

  fastify.get<{ Querystring: IdsParams }>(
    '/',
    { schema: getMany, preHandler: fastify.fetchMemberInSession },
    async ({ member, query: { id: ids }, log }) => {
      return itemService.getMany(member, buildRepositories(), ids);
    },
  );

  // get own
  fastify.get(
    '/own',
    { schema: getOwn, preHandler: fastify.verifyAuthentication },
    async ({ member, log }) => {
      return itemService.getOwn(member, buildRepositories());
    },
  );

  // get shared with
  fastify.get<{ Querystring: { permission?: PermissionLevel } }>(
    '/shared-with',
    {
      schema: getShared,
      preHandler: fastify.verifyAuthentication,
    },
    async ({ member, log, query }) => {
      return itemService.getShared(member, buildRepositories(), query.permission);
    },
  );

  // get item's children
  fastify.get<{ Params: IdParam; Querystring: Ordered }>(
    '/:id/children',
    { schema: getChildren, preHandler: fastify.fetchMemberInSession },
    async ({ member, params: { id }, query: { ordered }, log }) => {
      return itemService.getChildren(member, buildRepositories(), id, ordered);
    },
  );

  // get item's descendants
  fastify.get<{ Params: IdParam }>(
    '/:id/descendants',
    { schema: getDescendants, preHandler: fastify.fetchMemberInSession },
    async ({ member, params: { id }, log }) => {
      return itemService.getDescendants(member, buildRepositories(), id);
    },
  );

  // get item's parents
  fastify.get<{ Params: IdParam }>(
    '/:id/parents',
    {
      schema: getParents,
      preHandler: fastify.fetchMemberInSession,
    },
    async ({ member, params: { id }, log }) => {
      return itemService.getParents(member, buildRepositories(), id);
    },
  );

  // update item
  fastify.patch<{ Params: IdParam; Body: Partial<Item> }>(
    '/:id',
    {
      schema: items.extendExtrasUpdateSchema(),
      preHandler: fastify.verifyAuthentication,
    },
    async (request, reply) => {
      const {
        member,
        params: { id },
        body,
        log,
      } = request;
      const item = await db.transaction((manager) => {
        return itemService.patch(member, buildRepositories(manager), id, body);
      });
      actionItemService.postPatchAction(request, reply, item);
      return item;
    },
  );

  fastify.patch<{ Querystring: IdsParams; Body: Partial<Item> }>(
    '/',
    {
      schema: updateMany(items.extendExtrasUpdateSchema()),
      preHandler: fastify.verifyAuthentication,
    },
    async (request, reply) => {
      const {
        member,
        query: { id: ids },
        body,
        log,
      } = request;
      db.transaction((manager) => {
        // TODO: implement queue
        return itemService.patchMany(member, buildRepositories(manager), ids, body);
      })
        .then((resultItems) => {
          // do not wait
          actionItemService.postManyPatchAction(request, reply, resultOfToList(resultItems));
        })
        .catch((e) => {
          // TODO: return feedback in queue
          console.error(e);
        });
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );

  // TODO: REMOVE - deleting an item could delete a big tree and take time -> better to use many
  // delete item
  // fastify.delete<{ Params: IdParam }>(
  //   '/:id',
  //   { schema: deleteOne },
  //   async ({ member, params: { id }, log }, reply) => {
  //     db.transaction((manager) => {
  //       // TODO: implement queue
  //       return itemService.delete(member, buildRepositories(manager), id);
  //     }).catch((e) => {
  //       // TODO: return feedback in queue
  //       console.error(e);
  //     });
  //     reply.status(StatusCodes.ACCEPTED);
  //     return id;
  //   },
  // );

  fastify.delete<{ Querystring: IdsParams }>(
    '/',
    {
      schema: deleteMany,
      preHandler: fastify.verifyAuthentication,
    },
    async (request, reply) => {
      const {
        member,
        query: { id: ids },
        log,
      } = request;
      db.transaction((manager) => {
        // TODO: implement queue
        return itemService.deleteMany(member, buildRepositories(manager), ids);
      })
        .then((items) => {
          // do not wait
          actionItemService.postManyDeleteAction(request, reply, items);
        })
        .catch((e) => {
          // TODO: return feedback in queue
          console.error(e);
        });
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );

  // TODO: REMOVE - moving an item could delete a big tree and take time -> better to use many
  // move item
  // fastify.post<{ Params: IdParam; Body: ParentIdParam }>(
  //   '/:id/move',
  //   { schema: moveOne },
  //   async ({ member, params: { id }, body: { parentId }, log }, reply) => {
  //     // TODO: implement queue
  //     db.transaction(async (manager) => {
  //       return itemService.move(member, buildRepositories(manager), id, parentId);
  //     }).catch((e) => {
  //       // TODO: return feedback in queue
  //       console.error(e);
  //     });
  //     reply.status(StatusCodes.ACCEPTED);
  //     return id;
  //   },
  // );

  fastify.post<{ Querystring: IdsParams; Body: ParentIdParam }>(
    '/move',
    { schema: moveMany, preHandler: fastify.verifyAuthentication },
    async (request, reply) => {
      const {
        member,
        query: { id: ids },
        body: { parentId },
        log,
      } = request;
      // TODO: implement queue
      db.transaction(async (manager) => {
        return itemService.moveMany(member, buildRepositories(manager), ids, parentId);
      })
        .then((items) => {
          // we do not wait
          actionItemService.postManyMoveAction(request, reply, items);
        })
        .catch((e) => {
          // TODO: return feedback in queue
          console.error(e);
        });
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );

  // TODO: REMOVE - copying an item could copy a big tree and take time -> better to use many
  // copy item
  // fastify.post<{ Params: IdParam; Body: { parentId: string } }>(
  //   '/:id/copy',
  //   { schema: copyOne },
  //   async ({ member, params: { id }, body: { parentId }, log }, reply) => {
  //     // TODO: implement queue
  //     db.transaction(async (manager) => {
  //       return itemService.copy(member, buildRepositories(manager), id, {
  //         parentId,
  //       });
  //     }).catch((e) => {
  //       // TODO: return feedback in queue
  //       console.error(e);
  //     });
  //     reply.status(StatusCodes.ACCEPTED);
  //     return id;
  //   },
  // );

  fastify.post<{
    Querystring: IdsParams;
    Body: { parentId: string };
  }>(
    '/copy',
    { schema: copyMany, preHandler: fastify.verifyAuthentication },
    async (request, reply) => {
      const {
        member,
        query: { id: ids },
        body: { parentId },
        log,
      } = request;
      // TODO: implement queue
      db.transaction(async (manager) => {
        return itemService.copyMany(member, buildRepositories(manager), ids, {
          parentId,
        });
      })
        .then((items) => {
          // do not wait
          actionItemService.postManyCopyAction(request, reply, items);
        })
        .catch((e) => {
          // TODO: return feedback in queue
          console.error(e);
        });
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );
};

export default plugin;
