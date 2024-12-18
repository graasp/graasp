import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import fp from 'fastify-plugin';

import { ExportActionsFormatting, FileItemType } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { asDefined } from '../../../../utils/assertions';
import { CLIENT_HOSTS } from '../../../../utils/config';
import { buildRepositories } from '../../../../utils/repositories';
import { ActionService } from '../../../action/services/action';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import {
  LocalFileConfiguration,
  S3FileConfiguration,
} from '../../../file/interfaces/configuration';
import { assertIsMember } from '../../../member/entities/member';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ItemService } from '../../service';
import { ItemOpFeedbackErrorEvent, ItemOpFeedbackEvent, memberItemsTopic } from '../../ws/events';
import { CannotPostAction } from './errors';
import { ActionRequestExportService } from './requestExport/service';
import { exportActions, getAggregateActions, getItemActions, postAction } from './schemas';
import { ActionItemService } from './service';

export interface GraaspActionsOptions {
  shouldSave?: boolean;
  fileItemType: FileItemType;
  fileConfigurations: { s3: S3FileConfiguration; local: LocalFileConfiguration };
}

const plugin: FastifyPluginAsyncTypebox<GraaspActionsOptions> = async (fastify) => {
  const { db, websockets } = fastify;

  const itemService = resolveDependency(ItemService);
  const actionService = resolveDependency(ActionService);
  const actionItemService = resolveDependency(ActionItemService);
  const requestExportService = resolveDependency(ActionRequestExportService);

  const allowedOrigins = Object.values(CLIENT_HOSTS).map(({ url }) => url.origin);

  // get actions and more data matching the given `id`
  fastify.get(
    '/:id/actions',
    {
      schema: getItemActions,
      preHandler: isAuthenticated,
    },
    async ({ user, params: { id }, query }) => {
      // remove itemMemberships from return
      const { itemMemberships: _, ...result } = await actionItemService.getBaseAnalyticsForItem(
        user?.account,
        buildRepositories(),
        {
          sampleSize: query.requestedSampleSize,
          itemId: id,
          view: query.view?.toLowerCase(),
          startDate: query.startDate,
          endDate: query.endDate,
        },
      );
      return result;
    },
  );

  // get actions aggregate data matching the given `id`
  fastify.get(
    '/:id/actions/aggregation',
    {
      schema: getAggregateActions,
      preHandler: isAuthenticated,
    },
    async ({ user, params: { id }, query }) => {
      return actionItemService.getAnalyticsAggregation(user?.account, buildRepositories(), {
        sampleSize: query.requestedSampleSize,
        itemId: id,
        view: query.view?.toLowerCase(),
        type: query.type,
        countGroupBy: query.countGroupBy,
        aggregationParams: {
          aggregateFunction: query.aggregateFunction,
          aggregateMetric: query.aggregateMetric,
          aggregateBy: query.aggregateBy,
        },
        startDate: query.startDate,
        endDate: query.endDate,
      });
    },
  );

  fastify.post(
    '/:id/actions',
    {
      schema: postAction,
      preHandler: optionalIsAuthenticated,
    },
    async (request, reply) => {
      const {
        user,
        params: { id: itemId },
        body: { type, extra = {} },
      } = request;
      const member = user?.account;

      // allow only from known hosts
      if (!request.headers.origin) {
        throw new CannotPostAction();
      }
      if (!allowedOrigins.includes(request.headers.origin)) {
        throw new CannotPostAction(request.headers.origin);
      }

      await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const item = await itemService.get(member, repositories, itemId);
        await actionService.postMany(member, repositories, request, [
          {
            item,
            type,
            extra,
          },
        ]);
      });
      reply.status(StatusCodes.NO_CONTENT);
    },
  );

  // export actions matching the given `id`
  fastify.post(
    '/:id/actions/export',
    {
      schema: exportActions,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        user,
        params: { id: itemId },
        query: { format = ExportActionsFormatting.JSON },
        log,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);
      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const item = await requestExportService.request(member, repositories, itemId, format);
        if (item) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('export', [itemId], { [item.id]: item }),
          );
        }
      }).catch((e: Error) => {
        log.error(e);
        websockets.publish(
          memberItemsTopic,
          member.id,
          ItemOpFeedbackErrorEvent('export', [itemId], e),
        );
      });

      // reply no content and let the server create the archive and send the mail
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default fp(plugin);
