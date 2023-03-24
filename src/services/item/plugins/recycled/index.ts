import { FastifyPluginAsync } from 'fastify';

import {
  Actor,
  GraaspError,
  IdParam,
  IdsParams,
  MAX_TARGETS_FOR_MODIFY_REQUEST,
  MAX_TARGETS_FOR_READ_REQUEST,
  PostHookHandlerType,
} from '@graasp/sdk';

import { buildRepositories } from '../../../../util/repositories';
import schemas, {
  getRecycledItemDatas,
  recycleMany,
  recycleOne,
  restoreMany,
  restoreOne,
} from './schemas';
import { RecycledBinService } from './service';

export interface RecycledItemDataOptions {
  /** Max number of items to recycle in a request.
   * A number above this value will trigger an immediate bad request (400). Defaults to `10`. */
  maxItemsInRequest: number;
  /** Max number of items to recycle in a request w/ response. A number of items less or equal
   * to this value will make the server completely finish the execution before returning a response.
   * Above this value, the server will immediatly return a 202 (accepted) and the execution
   * will continue "in the back". **This value should be smaller than `maxItemsInRequest`**
   * otherwise it has no effect. Defaults to `5`. */
  maxItemsWithResponse: number;
  recycleItemPostHook?: PostHookHandlerType<string>;
}

const plugin: FastifyPluginAsync<RecycledItemDataOptions> = async (fastify, options) => {
  const { db } = fastify;
  const {
    maxItemsInRequest = MAX_TARGETS_FOR_READ_REQUEST,
    maxItemsWithResponse = MAX_TARGETS_FOR_MODIFY_REQUEST,
  } = options;

  const recycleBinService = new RecycledBinService();

  fastify.addSchema(schemas);

  // Note: it's okay to not prevent memberships changes on recycled items
  // it is not really possible to change them in the interface
  // but it won't break anything

  // API endpoints

  // get own recycled items data
  fastify.get<{ Params: IdParam }>(
    '/recycled',
    { schema: getRecycledItemDatas, preHandler: fastify.verifyAuthentication },
    async ({ member, log }) => {
      const sd = await recycleBinService.getAll(member, buildRepositories());
      console.log(sd);
      return sd;
    },
  );

  // TO RECYCLE: restore one item could restore a whole tree
  // recycle item
  // fastify.post<{ Params: IdParam }>(
  //   '/:id/recycle',
  //   { schema: recycleOne },
  //   async ({ member, params: { id: itemId }, log }) => {
  //     return db.transaction(async (manager) => {
  //       return recycleBinService.recycle(member, buildRepositories(manager), itemId);
  //     });
  //   },
  // );

  // recycle multiple items
  fastify.post<{ Querystring: IdsParams }>(
    '/recycle',
    { schema: recycleMany(maxItemsInRequest), preHandler: fastify.verifyAuthentication },
    async ({ member, query: { id: ids }, log }, reply) => {
      db.transaction(async (manager) => {
        return recycleBinService.recycleMany(member, buildRepositories(manager), ids);
      }).catch((e) => {
        // TODO: return feedback in queue
        console.error(e);
      });

      reply.status(202);
      return ids;
    },
  );

  // TO REMOVE: restore one item could restore a whole tree
  // restore one item
  // fastify.post<{ Params: IdParam }>(
  //   '/:id/restore',
  //   { schema: restoreOne },
  //   async ({ member, params: { id }, log }) => {
  //     log.info(`Restore item '${id}'`);
  //     return db.transaction(async (manager) => {
  //       return recycleBinService.restoreOne(member, buildRepositories(manager), id);
  //     });
  //   },
  // );

  // restore multiple items
  fastify.post<{ Querystring: IdsParams }>(
    '/restore',
    { schema: restoreMany(maxItemsInRequest), preHandler: fastify.verifyAuthentication },
    async ({ member, query: { id: ids }, log }, reply) => {
      log.info(`Restoring items ${ids}`);

      db.transaction(async (manager) => {
        return recycleBinService.restoreMany(member, buildRepositories(manager), ids);
      }).catch((e) => {
        // TODO: return feedback in queue
        console.error(e);
      });
      reply.status(202);
      return ids;
    },
  );
};

export default plugin;
