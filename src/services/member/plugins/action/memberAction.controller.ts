import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { FileItemType } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { isAuthenticated } from '../../../auth/plugins/passport';
import {
  LocalFileConfiguration,
  S3FileConfiguration,
} from '../../../file/interfaces/configuration';
import { deleteAllById, getMemberFilteredActions } from './memberAction.schemas';
import { ActionMemberService } from './memberAction.service';

export interface GraaspActionsOptions {
  shouldSave?: boolean;
  fileItemType: FileItemType;
  fileConfigurations: {
    s3: S3FileConfiguration;
    local: LocalFileConfiguration;
  };
}

const plugin: FastifyPluginAsyncTypebox<GraaspActionsOptions> = async (fastify) => {
  const actionMemberService = resolveDependency(ActionMemberService);

  fastify.get(
    '/actions',
    { schema: getMemberFilteredActions, preHandler: isAuthenticated },
    async ({ user, query }) => {
      const account = asDefined(user?.account);
      return actionMemberService.getFilteredActions(db, account, query);
    },
  );

  // todo: delete self data
  // delete all the actions matching the given `memberId`
  fastify.delete(
    '/members/:id/delete',
    { schema: deleteAllById, preHandler: isAuthenticated },
    async ({ user, params: { id } }) => {
      const account = asDefined(user?.account);
      return db.transaction(async (tx) => {
        return actionMemberService.deleteAllForMember(tx, account, id);
      });
    },
  );
};

export default plugin;
