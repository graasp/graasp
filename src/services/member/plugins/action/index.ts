import { FastifyPluginAsync } from 'fastify';

import { FileItemType } from '@graasp/sdk';

import { IdParam } from '../../../../types';
import { buildRepositories } from '../../../../utils/repositories';
import { authenticated } from '../../../auth/plugins/passport';
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
  const {
    actions: { service: actionService },
    db,
  } = fastify;

  const actionMemberService = new ActionMemberService(actionService);

  fastify.get<{ Querystring: { startDate?: string; endDate?: string } }>(
    '/actions',
    { schema: getMemberFilteredActions, preHandler: fastify.verifyAuthentication },
    async ({ member, query }) => {
      return actionMemberService.getFilteredActions(member, buildRepositories(), query);
    },
  );
  // todo: delete self data
  // delete all the actions matching the given `memberId`
  fastify.delete<{ Params: IdParam }>(
    '/members/:id/delete',
    { schema: deleteAllById, preHandler: authenticated },
    async ({ user, params: { id } }) => {
      return db.transaction(async (manager) => {
        return actionMemberService.deleteAllForMember(user!.member, buildRepositories(manager), id);
      });
    },
  );
};

export default plugin;
