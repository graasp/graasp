import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import {
  AggregateBy,
  AggregateFunction,
  AggregateMetric,
  Context,
  CountGroupBy,
  FileItemType,
  IdParam,
  LocalFileConfiguration,
  S3FileConfiguration,
} from '@graasp/sdk';

import { buildRepositories } from '../../../../utils/repositories';
import { ActionRequestExportService } from './requestExport/service';
import { exportAction, getAggregateActions, getItemActions } from './schemas';
import { ActionItemService } from './service';
import { validateAggregateRequest } from './utils';

export interface GraaspActionsOptions {
  shouldSave?: boolean;
  fileItemType: FileItemType;
  fileConfigurations: { s3: S3FileConfiguration; local: LocalFileConfiguration };
}

const plugin: FastifyPluginAsync<GraaspActionsOptions> = async (fastify) => {
  const {
    files: { service: fileService },
    actions: { service: actionService },
    items: { service: itemService },
    members: { service: memberService },
    mailer,
    db,
  } = fastify;

  const actionItemService = new ActionItemService(actionService, itemService, memberService);
  fastify.items.actions = { service: actionItemService };

  const requestExportService = new ActionRequestExportService(
    actionService,
    actionItemService,
    itemService,
    fileService,
    mailer,
  );

  // get actions and more data matching the given `id`
  fastify.get<{ Params: IdParam; Querystring: { requestedSampleSize?: number; view?: Context } }>(
    '/:id/actions',
    {
      schema: getItemActions,
      preHandler: fastify.verifyAuthentication,
    },
    async ({ member, params: { id }, query }) => {
      return actionItemService.getBaseAnalyticsForItem(member, buildRepositories(), {
        sampleSize: query.requestedSampleSize,
        itemId: id,
        view: query.view?.toLowerCase(),
      });
    },
  );

  // get actions aggregate data matching the given `id`
  fastify.get<{
    Params: IdParam;
    Querystring: {
      requestedSampleSize: number;
      view: Context;
      type?: string[];
      countGroupBy: CountGroupBy[];
      aggregateFunction: AggregateFunction;
      aggregateMetric: AggregateMetric;
      aggregateBy?: AggregateBy[];
    };
  }>(
    '/:id/actions/aggregation',
    {
      schema: getAggregateActions,
      preHandler: fastify.verifyAuthentication,
    },
    async ({ member, params: { id }, query }) => {
      // validate request
      validateAggregateRequest(
        query.countGroupBy,
        query.aggregateFunction,
        query.aggregateMetric,
        query.aggregateBy,
      );

      return actionItemService.getAnalyticsAggregation(member, buildRepositories(), {
        sampleSize: query.requestedSampleSize,
        itemId: id,
        view: query.view?.toLowerCase(),
        type: query.type,
        countGroupBy: query.countGroupBy,
        aggregateFunction: query.aggregateFunction,
        aggregateMetric: query.aggregateMetric,
        aggregateBy: query.aggregateBy,
      });
    },
  );

  // get actions matching the given `id`
  fastify.route<{ Params: IdParam }>({
    method: 'POST',
    url: '/:id/actions/export',
    schema: exportAction,
    preHandler: fastify.verifyAuthentication,
    handler: async ({ member, params: { id: itemId }, log }, reply) => {
      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        await requestExportService.request(member, repositories, itemId);
      })
        .then(() => {
          // todo: save action
        })
        .catch((e) => {
          // TODO: return feedback in queue
          console.error(e);
        });

      // reply no content and let the server create the archive and send the mail
      reply.status(StatusCodes.NO_CONTENT);
    },
  });
};

export default fp(plugin);
