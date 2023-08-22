import { FastifyPluginAsync } from 'fastify';

import { FileItemType, IdParam, LocalFileConfiguration, S3FileConfiguration } from '@graasp/sdk';

import { buildRepositories } from '../../../../utils/repositories';
import { deleteAllById } from './schemas';
import { ActionMemberService } from './service';

export interface GraaspActionsOptions {
  shouldSave?: boolean;
  fileItemType: FileItemType;
  fileConfigurations: { s3: S3FileConfiguration; local: LocalFileConfiguration };
}

const plugin: FastifyPluginAsync<GraaspActionsOptions> = async (fastify, options) => {
  const {
    actions: { service: actionService },
    db,
  } = fastify;

  const actionMemberService = new ActionMemberService(actionService);

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
