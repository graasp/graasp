import { FastifyPluginAsync } from 'fastify';

import { FileItemType } from '@graasp/sdk';

import { IdParam } from '../../../../types.js';
import { buildRepositories } from '../../../../utils/repositories.js';
import { isAuthenticated } from '../../../auth/plugins/passport/index.js';
import {
  LocalFileConfiguration,
  S3FileConfiguration,
} from '../../../file/interfaces/configuration.js';
import { deleteAllById, getMemberFilteredActions } from './schemas.js';
import { ActionMemberService } from './service.js';

export type GraaspActionsOptions = {
  shouldSave?: boolean;
  fileItemType: FileItemType;
  fileConfigurations: { s3: S3FileConfiguration; local: LocalFileConfiguration };
};

const plugin: FastifyPluginAsync<GraaspActionsOptions> = async (fastify) => {
  const {
    actions: { service: actionService },
    db,
  } = fastify;

  const actionMemberService = new ActionMemberService(actionService);

  fastify.get<{ Querystring: { startDate?: string; endDate?: string } }>(
    '/actions',
    { schema: getMemberFilteredActions, preHandler: isAuthenticated },
    async ({ user, query }) => {
      return actionMemberService.getFilteredActions(user?.member, buildRepositories(), query);
    },
  );
  // todo: delete self data
  // delete all the actions matching the given `memberId`
  fastify.delete<{ Params: IdParam }>(
    '/members/:id/delete',
    { schema: deleteAllById, preHandler: isAuthenticated },
    async ({ user, params: { id } }) => {
      return db.transaction(async (manager) => {
        return actionMemberService.deleteAllForMember(user?.member, buildRepositories(manager), id);
      });
    },
  );
};

export default plugin;
