import { FastifyPluginAsync } from 'fastify';

import { FileItemType } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { IdParam } from '../../../../types';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated } from '../../../auth/plugins/passport';
import {
  LocalFileConfiguration,
  S3FileConfiguration,
} from '../../../file/interfaces/configuration';
import { deleteAllById, getMemberFilteredActions } from './schemas';
import { ActionMemberService } from './service';

export interface GraaspActionsOptions {
  shouldSave?: boolean;
  fileItemType: FileItemType;
  fileConfigurations: { s3: S3FileConfiguration; local: LocalFileConfiguration };
}

const plugin: FastifyPluginAsync<GraaspActionsOptions> = async (fastify) => {
  const { db } = fastify;

  const actionMemberService = resolveDependency(ActionMemberService);

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
