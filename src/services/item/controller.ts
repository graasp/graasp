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
import { ItemOpFeedbackEvent, memberItemsTopic } from './ws/events';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, items, websockets } = fastify;
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
      return await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const item = await itemService.post(member, repositories, {
          item: data,
          parentId,
        });
        await actionItemService.postPostAction(request, reply, repositories, item);
        return item;
      });
    },
  );

  // get item
  fastify.get<{ Params: IdParam }>(
    '/:id',
    {
      schema: getOne,
      preHandler: fastify.attemptVerifyAuthentication,
    },
    async ({ member, params: { id }, log }) => {
      return itemService.get(member, buildRepositories(), id);
    },
  );

  fastify.get<{ Querystring: IdsParams }>(
    '/',
    { schema: getMany, preHandler: fastify.attemptVerifyAuthentication },
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
    { schema: getChildren, preHandler: fastify.attemptVerifyAuthentication },
    async ({ member, params: { id }, query: { ordered }, log }) => {
      return itemService.getChildren(member, buildRepositories(), id, ordered);
    },
  );

  // get item's descendants
  fastify.get<{ Params: IdParam }>(
    '/:id/descendants',
    { schema: getDescendants, preHandler: fastify.attemptVerifyAuthentication },
    async ({ member, params: { id }, log }) => {
      return itemService.getDescendants(member, buildRepositories(), id);
    },
  );

  // get item's parents
  fastify.get<{ Params: IdParam }>(
    '/:id/parents',
    {
      schema: getParents,
      preHandler: fastify.attemptVerifyAuthentication,
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
      return await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const item = await itemService.patch(member, repositories, id, body);
        await actionItemService.postPatchAction(request, reply, repositories, item);
        return item;
      });
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
      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const items = await itemService.patchMany(member, repositories, ids, body);
        await actionItemService.postManyPatchAction(
          request,
          reply,
          repositories,
          resultOfToList(items),
        );
        if (member) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('update', ids, items),
          );
        }
      }).catch((e: Error) => {
        log.error(e);
        if (member) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('update', ids, { error: e }),
          );
        }
      });
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );

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
      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const items = await itemService.deleteMany(member, repositories, ids);
        await actionItemService.postManyDeleteAction(request, reply, repositories, items);
        if (member) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('delete', ids, {
              data: Object.fromEntries(items.map((i) => [i.id, i])),
              errors: [],
            }),
          );
        }
      }).catch((e) => {
        log.error(e);
        if (member) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('delete', ids, { error: e }),
          );
        }
      });
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );

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
      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const items = await itemService.moveMany(member, repositories, ids, parentId);
        await actionItemService.postManyMoveAction(request, reply, repositories, items);
        if (member) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('move', ids, {
              data: Object.fromEntries(items.map((i) => [i.id, i])),
              errors: [],
            }),
          );
        }
      }).catch((e) => {
        log.error(e);
        if (member) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('move', ids, { error: e }),
          );
        }
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
    { schema: copyMany, preHandler: fastify.verifyAuthentication },
    async (request, reply) => {
      const {
        member,
        query: { id: ids },
        body: { parentId },
        log,
      } = request;
      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const items = await itemService.copyMany(member, repositories, ids, {
          parentId,
        });
        await actionItemService.postManyCopyAction(request, reply, repositories, items);
        if (member) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('copy', ids, {
              data: Object.fromEntries(items.map((i) => [i.id, i])),
              errors: [],
            }),
          );
        }
      }).catch((e) => {
        log.error(e);
        if (member) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('copy', ids, { data: {}, errors: [e] }),
          );
        }
      });
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );
};

export default plugin;
