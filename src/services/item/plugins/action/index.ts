import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import {
  Context,
  FileItemType,
  Hostname,
  IdParam,
  LocalFileConfiguration,
  S3FileConfiguration,
} from '@graasp/sdk';

import { buildRepositories } from '../../../../utils/repositories';
import { ActionRequestExportService } from './requestExport/service';
import { ActionItemService } from './service';

export interface GraaspActionsOptions {
  shouldSave?: boolean;
  hosts: Hostname[];
  fileItemType: FileItemType;
  fileConfigurations: { s3: S3FileConfiguration; local: LocalFileConfiguration };
}

const plugin: FastifyPluginAsync<GraaspActionsOptions> = async (fastify, options) => {
  const {
    files: { service: fileService },
    actions: { service: actionService },
    items: { service: itemService },
    members: { service: memberService },
    hosts,
    mailer,
    db,
  } = fastify;

  const actionItemService = new ActionItemService(actionService, itemService, memberService, hosts);
  fastify.items.actions = { service: actionItemService };

  const requestExportService = new ActionRequestExportService(
    actionService,
    actionItemService,
    itemService,
    fileService,
    mailer,
    hosts,
  );

  // get actions and more data matching the given `id`
  fastify.get<{ Params: IdParam; Querystring: { requestedSampleSize?: number; view?: Context } }>(
    '/:id/actions',
    {
      // schema: getItemActions,
      preHandler: fastify.verifyAuthentication,
    },
    async ({ member, params: { id }, query }, reply) => {
      return actionItemService.getBaseAnalyticsForItem(member, buildRepositories(), {
        sampleSize: query.requestedSampleSize,
        itemId: id,
        view: query.view,
      });
    },
  );

  // get actions matching the given `id`
  fastify.route<{ Params: IdParam }>({
    method: 'POST',
    url: '/:id/actions/export',
    // schema: exportAction,
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
