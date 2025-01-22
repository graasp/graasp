import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { PermissionLevel, PublicationStatus } from '@graasp/sdk';

import { resolveDependency } from '../../../../../di/utils';
import { asDefined } from '../../../../../utils/assertions';
import { buildRepositories } from '../../../../../utils/repositories';
import { isAuthenticated } from '../../../../auth/plugins/passport';
import { matchOne } from '../../../../authorization';
import { assertIsMember } from '../../../../member/entities/member';
import { memberAccountRole } from '../../../../member/strategies/memberAccountRole';
import { validatedMemberAccountRole } from '../../../../member/strategies/validatedMemberAccountRole';
import { ItemService } from '../../../service';
import {
  ItemOpFeedbackErrorEvent,
  ItemOpFeedbackEvent,
  memberItemsTopic,
} from '../../../ws/events';
import { FolderItemService } from '../../folder/service';
import { ItemPublishedService } from '../published/service';
import { getItemValidationGroup, getLatestItemValidationGroup, validateItem } from './schemas';
import { ItemValidationService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db, websockets } = fastify;

  const validationService = resolveDependency(ItemValidationService);
  const publishService = resolveDependency(ItemPublishedService);
  const itemService = resolveDependency(ItemService);
  const folderItemService = resolveDependency(FolderItemService);

  // get validation status of given itemId
  fastify.get(
    '/:itemId/validations/latest',
    {
      schema: getLatestItemValidationGroup,
      preHandler: [isAuthenticated, matchOne(memberAccountRole)],
    },
    async ({ user, params: { itemId } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      const item = await itemService.get(member, buildRepositories(), itemId);
      return await validationService.getLastItemValidationGroupForItem(
        member,
        buildRepositories(),
        item,
      );
    },
  );

  // get validation group
  fastify.get(
    '/:itemId/validations/:itemValidationGroupId',
    {
      schema: getItemValidationGroup,
      preHandler: [isAuthenticated, matchOne(memberAccountRole)],
    },
    async ({ user, params: { itemValidationGroupId } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return await validationService.getItemValidationGroup(
        member,
        buildRepositories(),
        itemValidationGroupId,
      );
    },
  );

  // validate item with given itemId in param
  fastify.post(
    '/:itemId/validate',
    {
      schema: validateItem,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request, reply) => {
      const {
        user,
        params: { itemId },
        log,
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);

      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        // get item and check permission
        // only folder items are allowed as root for validation
        const item = await folderItemService.get(
          member,
          repositories,
          itemId,
          PermissionLevel.Admin,
        );

        const notifyOnValidationChanges = () => {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('validate', [itemId], { [item.id]: item }),
          );
        };

        const hasValidationSucceeded = await validationService.post(
          repositories,
          item,
          notifyOnValidationChanges,
        );

        if (hasValidationSucceeded) {
          // publish automatically the item if it is valid.
          // private item will be set to public automatically (should ask the user on the frontend).
          await publishService.publishIfNotExist(
            member,
            repositories,
            itemId,
            PublicationStatus.ReadyToPublish,
          );
        }

        // the process could take long time, so let the process run in the background and return the itemId instead
        notifyOnValidationChanges();
      }).catch((e: Error) => {
        log.error(e);
        websockets.publish(
          memberItemsTopic,
          member.id,
          ItemOpFeedbackErrorEvent('validate', [itemId], e),
        );
      });

      reply.status(StatusCodes.ACCEPTED);
      return itemId;
    },
  );

  // ADMIN PANEL ENDPOINTS
  // update manual review record of given entry
  // fastify.post<{ Params: { id: string }; Body: { status: string; reason: string } }>(
  //   '/validations/:id/review',
  //   {
  //     // schema: itemValidationReview
  //   },
  //   async ({ member, params: { id }, body: data, log }) => {
  //     return db.transaction(async manager => {
  //       return validationService.postReview(member, buildRepositories(manager), id, data);
  //     });
  //   },
  // );
  // get all entries need manual review
  // fastify.get(
  //   '/validations/reviews',
  //   {
  //     // schema: itemValidationReviews
  //   },
  //   async ({ member, log }) => {
  //     return validationService.getValidationReviews(member, buildRepositories());
  //   },
  // );
};

export default plugin;
