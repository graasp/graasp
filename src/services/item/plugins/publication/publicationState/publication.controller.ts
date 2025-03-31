import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../../di/utils';
import { db } from '../../../../../drizzle/db';
import { asDefined } from '../../../../../utils/assertions';
import { UnauthorizedMember } from '../../../../../utils/errors';
import { isAuthenticated } from '../../../../auth/plugins/passport';
import { getPublicationState } from './publication.schemas';
import { PublicationService } from './publication.service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const publicationService = resolveDependency(PublicationService);

  fastify.get(
    '/publication/:itemId/status',
    {
      schema: getPublicationState,
      preHandler: isAuthenticated,
    },
    async ({ user, params: { itemId } }) => {
      const account = asDefined(user?.account, UnauthorizedMember);
      return await publicationService.computeStateForItem(db, account, itemId);
    },
  );
};
export default plugin;
