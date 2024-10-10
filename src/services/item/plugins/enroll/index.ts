import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import fp from 'fastify-plugin';

import { ItemLoginSchemaStatus, PermissionLevel } from '@graasp/sdk';

import { resolveDependency } from '../../../../di/utils';
import { asDefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated } from '../../../auth/plugins/passport';
import { hasPermission, matchOne } from '../../../authorization';
import {
  CannotEnrollFrozenItemLoginSchema,
  CannotEnrollItemWithoutItemLoginSchema,
} from '../../../itemLogin/errors';
import { ItemLoginService } from '../../../itemLogin/service';
import { ItemMembershipAlreadyExists } from '../../../itemMembership/plugins/MembershipRequest/error';
import { ItemMembershipService } from '../../../itemMembership/service';
import { assertIsMember } from '../../../member/entities/member';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { ItemService } from '../../service';
import { enroll } from './schema';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;
  const itemService = resolveDependency(ItemService);
  const itemLoginService = resolveDependency(ItemLoginService);
  const itemMembershipService = resolveDependency(ItemMembershipService);

  fastify.post(
    '/:itemId/enroll',
    {
      schema: enroll,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      const { itemId } = params;

      return await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        const item = await itemService.get(
          member,
          repositories,
          itemId,
          PermissionLevel.Read,
          false,
        );

        const itemLoginSchema = await itemLoginService.getByItemPath(repositories, item.path);
        if (!itemLoginSchema || itemLoginSchema.status === ItemLoginSchemaStatus.Disabled) {
          throw new CannotEnrollItemWithoutItemLoginSchema();
        } else if (itemLoginSchema.status === ItemLoginSchemaStatus.Freeze) {
          throw new CannotEnrollFrozenItemLoginSchema();
        }

        // Check if the member already has an access to the item (from membership or item visibility), if so, throw an error
        if (await hasPermission(repositories, PermissionLevel.Read, member, item)) {
          throw new ItemMembershipAlreadyExists();
        }

        return await itemMembershipService.create(
          member,
          repositories,
          {
            permission: PermissionLevel.Read,
            itemId,
            memberId: member.id,
          },
          false,
        );
      });
    },
  );
};

export default fp(plugin, {
  fastify: '4.x',
  name: 'graasp-plugin-enroll',
});
