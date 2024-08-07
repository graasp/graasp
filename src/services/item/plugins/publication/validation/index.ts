import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { PermissionLevel, PublicationStatus } from '@graasp/sdk';

import { resolveDependency } from '../../../../../di/utils';
import { notUndefined } from '../../../../../utils/assertions';
import { buildRepositories } from '../../../../../utils/repositories';
import { isAuthenticated } from '../../../../auth/plugins/passport';
import { matchOne } from '../../../../authorization';
import { validatedMember } from '../../../../member/strategies/validatedMember';
import { ItemService } from '../../../service';
import {
  ItemOpFeedbackErrorEvent,
  ItemOpFeedbackEvent,
  memberItemsTopic,
} from '../../../ws/events';
import { ItemPublishedService } from '../published/service';
import { itemValidation, itemValidationGroup } from './schemas';
import { ItemValidationService } from './service';
import { assertItemIsFolder } from './utils';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, websockets } = fastify;

  const validationService = resolveDependency(ItemValidationService);
  const publishService = resolveDependency(ItemPublishedService);
  const itemService = resolveDependency(ItemService);

  // get validation status of given itemId
  fastify.get<{ Params: { itemId: string } }>(
    '/:itemId/validations/latest',
    {
      schema: itemValidation,

      preHandler: isAuthenticated,
    },
    async ({ user, params: { itemId } }) => {
      const member = notUndefined(user?.member);
      const item = await itemService.get(member, buildRepositories(), itemId);
      return validationService.getLastItemValidationGroupForItem(member, buildRepositories(), item);
    },
  );

  // get validation group
  fastify.get<{ Params: { itemValidationGroupId: string } }>(
    '/:itemId/validations/:itemValidationGroupId',
    {
      schema: itemValidationGroup,
      preHandler: isAuthenticated,
    },
    async ({ user, params: { itemValidationGroupId } }) => {
      const member = notUndefined(user?.member);
      return validationService.getItemValidationGroup(
        member,
        buildRepositories(),
        itemValidationGroupId,
      );
    },
  );

  // validate item with given itemId in param
  fastify.post<{ Params: { itemId: string } }>(
    '/:itemId/validate',
    {
      schema: itemValidation,
      preHandler: [isAuthenticated, matchOne(validatedMember)],
    },
    async (request, reply) => {
      const {
        user,
        params: { itemId },
        log,
      } = request;
      const member = notUndefined(user?.member);

      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        // get item and check permission
        const item = await itemService.get(member, repositories, itemId, PermissionLevel.Admin);

        const notifyOnValidationChanges = () => {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('validate', [itemId], { [item.id]: item }),
          );
        };

        const hasValidationSucceeded = await validationService.post(
          repositories,
          assertItemIsFolder(item),
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
