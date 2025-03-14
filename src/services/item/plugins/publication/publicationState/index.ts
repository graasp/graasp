import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../../di/utils.js';
import { db } from '../../../../../drizzle/db.js';
import { asDefined } from '../../../../../utils/assertions.js';
import { UnauthorizedMember } from '../../../../../utils/errors.js';
import { isAuthenticated } from '../../../../auth/plugins/passport/index.js';
import { PublicationService } from './publication.service.js';
import { getPublicationState } from './schemas.js';

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
