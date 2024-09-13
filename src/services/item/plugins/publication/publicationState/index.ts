import { FastifyPluginAsync } from 'fastify';

import { UUID } from '@graasp/sdk';

import { resolveDependency } from '../../../../../di/utils';
import { asDefined } from '../../../../../utils/assertions';
import { UnauthorizedMember } from '../../../../../utils/errors';
import { buildRepositories } from '../../../../../utils/repositories';
import { isAuthenticated } from '../../../../auth/plugins/passport';
import { PublicationService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const publicationService = resolveDependency(PublicationService);

  fastify.get<{ Params: { itemId: UUID } }>(
    '/publication/:itemId/status',
    {
      preHandler: isAuthenticated,
    },
    async ({ user, params: { itemId } }) => {
      const account = asDefined(user?.account, UnauthorizedMember);
      return await publicationService.computeStateForItem(account, buildRepositories(), itemId);
    },
  );
};
export default plugin;
