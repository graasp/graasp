import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { MAX_TARGETS_FOR_READ_REQUEST } from '@graasp/sdk';

import { IdParam, IdsParams } from '../../../../types';
import { notUndefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { validatedMember } from '../../../member/strategies/validatedMember';
import { ItemOpFeedbackErrorEvent, ItemOpFeedbackEvent, memberItemsTopic } from '../../ws/events';
import schemas, { getRecycledItemDatas, recycleMany, restoreMany } from './schemas';
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
}

const plugin: FastifyPluginAsync<RecycledItemDataOptions> = async (fastify, options) => {
  const { db, websockets } = fastify;
  const { maxItemsInRequest = MAX_TARGETS_FOR_READ_REQUEST } = options;

  const recycleBinService = new RecycledBinService();

  fastify.addSchema(schemas);

  // Note: it's okay to not prevent memberships changes on recycled items
  // it is not really possible to change them in the interface
  // but it won't break anything

  // API endpoints

  // get own recycled items data
  fastify.get<{ Params: IdParam }>(
    '/recycled',
    { schema: getRecycledItemDatas, preHandler: isAuthenticated },
    async ({ user }) => {
      const member = notUndefined(user?.member);
      const result = await recycleBinService.getAll(member, buildRepositories());
      return result;
    },
  );

  // recycle multiple items
  fastify.post<{ Querystring: IdsParams }>(
    '/recycle',
    {
      schema: recycleMany(maxItemsInRequest),
      preHandler: [isAuthenticated, matchOne(validatedMember)],
    },
    async (request, reply) => {
      const {
        query: { id: ids },
        log,
        user,
      } = request;
      const member = notUndefined(user?.member);
      db.transaction(async (manager) => {
        const items = await recycleBinService.recycleMany(member, buildRepositories(manager), ids);
        websockets.publish(
          memberItemsTopic,
          member.id,
          ItemOpFeedbackEvent('recycle', ids, items.data, items.errors),
        );
        return items;
      }).catch((e: Error) => {
        log.error(e);
        websockets.publish(
          memberItemsTopic,
          member.id,
          ItemOpFeedbackErrorEvent('recycle', ids, e),
        );
      });

      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );

  // restore multiple items
  fastify.post<{ Querystring: IdsParams }>(
    '/restore',
    {
      schema: restoreMany(maxItemsInRequest),
      preHandler: [isAuthenticated, matchOne(validatedMember)],
    },
    async (request, reply) => {
      const {
        query: { id: ids },
        log,
        user,
      } = request;
      const member = notUndefined(user?.member);
      log.info(`Restoring items ${ids}`);

      db.transaction(async (manager) => {
        const items = await recycleBinService.restoreMany(member, buildRepositories(manager), ids);
        websockets.publish(
          memberItemsTopic,
          member.id,
          ItemOpFeedbackEvent('restore', ids, items.data, items.errors),
        );
      }).catch((e: Error) => {
        log.error(e);
        websockets.publish(
          memberItemsTopic,
          member.id,
          ItemOpFeedbackErrorEvent('restore', ids, e),
        );
      });
      reply.status(StatusCodes.ACCEPTED);
      return ids;
    },
  );
};

export default plugin;
