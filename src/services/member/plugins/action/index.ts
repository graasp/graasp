import { FastifyPluginAsync } from 'fastify';

import { FileItemType } from '@graasp/sdk';

import { IdParam } from '../../../../types';
import { buildRepositories } from '../../../../utils/repositories';
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
      return db.transaction(async (manager) => {
        return actionMemberService.getFilteredActions(member, buildRepositories(manager), query);
      });
    },
  );
  // todo: delete self data
  // delete all the actions matching the given `memberId`
  fastify.delete<{ Params: IdParam }>(
    '/members/:id/delete',
    { schema: deleteAllById, preHandler: fastify.verifyAuthentication },
    async ({ member, params: { id } }) => {
      return db.transaction(async (manager) => {
        return actionMemberService.deleteAllForMember(member, buildRepositories(manager), id);
      });
    },
  );
};

export default plugin;
