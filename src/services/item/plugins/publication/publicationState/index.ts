import { FastifyPluginAsync } from 'fastify';

import { UUID } from '@graasp/sdk';

import { resolveDependency } from '../../../../../di/utils';
import { notUndefined } from '../../../../../utils/assertions';
import { UnauthorizedMember } from '../../../../../utils/errors';
import { buildRepositories } from '../../../../../utils/repositories';
import { isAuthenticated } from '../../../../auth/plugins/passport';
import { ItemService } from '../../../service';
import { PublicationService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const itemService = resolveDependency(ItemService);
  const repositories = buildRepositories();
  const { itemTagRepository, itemValidationGroupRepository, itemPublishedRepository } =
    repositories;

  // This code will be improved by the DI
  const publicationService = new PublicationService(
    itemService,
    itemTagRepository,
    itemValidationGroupRepository,
    itemPublishedRepository,
  );

  fastify.get<{ Params: { itemId: UUID } }>(
    '/publication/:itemId/status',
    {
      preHandler: isAuthenticated,
    },
    async ({ user, params: { itemId } }) => {
      const member = notUndefined(user?.member, new UnauthorizedMember());

      return await publicationService.computeStateForItem(member, repositories, itemId);
    },
  );
};
export default plugin;
