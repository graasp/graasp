import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import fp from 'fastify-plugin';

import { ExportActionsFormatting, FileItemType } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { ALLOWED_ORIGINS } from '../../../../utils/config';
import { ActionService } from '../../../action/action.service';
import { isAuthenticated, matchOne, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import {
  LocalFileConfiguration,
  S3FileConfiguration,
} from '../../../file/interfaces/configuration';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ItemService } from '../../service';
import { ItemOpFeedbackErrorEvent, ItemOpFeedbackEvent, memberItemsTopic } from '../../ws/events';
import { ActionItemService } from './action.service';
import { CannotPostAction } from './errors';
import { ActionRequestExportService } from './requestExport/service';
import { exportActions, getItemActions, postAction } from './schemas';

export interface GraaspActionsOptions {
  shouldSave?: boolean;
  fileItemType: FileItemType;
  fileConfigurations: {
    s3: S3FileConfiguration;
    local: LocalFileConfiguration;
  };
}

const plugin: FastifyPluginAsyncTypebox<GraaspActionsOptions> = async (fastify) => {
  const { websockets } = fastify;

  const itemService = resolveDependency(ItemService);
  const actionService = resolveDependency(ActionService);
  const actionItemService = resolveDependency(ActionItemService);
  const requestExportService = resolveDependency(ActionRequestExportService);

  // get actions and more data matching the given `id`
  fastify.get(
    '/:id/actions',
    {
      schema: getItemActions,
      preHandler: isAuthenticated,
    },
    async ({ user, params: { id }, query }) => {
      const authenticatedUser = asDefined(user?.account);
      // remove itemMemberships from return
      const result = await actionItemService.getBaseAnalyticsForItem(db, authenticatedUser, {
        sampleSize: query.requestedSampleSize,
        itemId: id,
        view: query.view?.toLowerCase(),
        startDate: query.startDate,
        endDate: query.endDate,
      });
      return result;
    },
  );

  // get actions aggregate data matching the given `id`
  // fastify.get(
  //   '/:id/actions/aggregation',
  //   {
  //     schema: getAggregateActions,
  //     preHandler: isAuthenticated,
  //   },
  //   async ({ user, params: { id }, query }) => {
  //     return actionItemService.getAnalyticsAggregation(db, user?.account, {
  //       sampleSize: query.requestedSampleSize,
  //       itemId: id,
  //       view: query.view?.toLowerCase(),
  //       type: query.type,
  //       countGroupBy: query.countGroupBy,
  //       aggregationParams: {
  //         aggregateFunction: query.aggregateFunction,
  //         aggregateMetric: query.aggregateMetric,
  //         aggregateBy: query.aggregateBy,
  //       },
  //       startDate: query.startDate,
  //       endDate: query.endDate,
  //     });
  //   },
  // );

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
      if (!ALLOWED_ORIGINS.includes(request.headers.origin)) {
        throw new CannotPostAction(request.headers.origin);
      }

      await db.transaction(async (tx) => {
        const item = await itemService.basicItemService.get(tx, member, itemId);
        await actionService.postMany(tx, member, request, [
          {
            item,
            type,
            extra: JSON.stringify(extra),
            // FIX: define the view !
            // view: ??
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

      // reply no content and let the server create the archive and send the mail
      reply.status(StatusCodes.NO_CONTENT);

      await db
        .transaction(async (tx) => {
          const item = await requestExportService.request(tx, member, itemId, format);
          if (item) {
            websockets.publish(
              memberItemsTopic,
              member.id,
              ItemOpFeedbackEvent('export', [itemId], { [item.id]: item }),
            );
          }
        })
        .catch((e: Error) => {
          log.error(e);
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackErrorEvent('export', [itemId], e),
          );
        });
    },
  );
};

export default fp(plugin);
