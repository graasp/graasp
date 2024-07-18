import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { resolveDependency } from '../../../../../di/utils';
import { notUndefined } from '../../../../../utils/assertions';
import { buildRepositories } from '../../../../../utils/repositories';
import { isAuthenticated } from '../../../../auth/plugins/passport';
import {
  ItemOpFeedbackErrorEvent,
  ItemOpFeedbackEvent,
  memberItemsTopic,
} from '../../../ws/events';
import { ItemPublishedService } from '../published/service';
import { itemValidation, itemValidationGroup } from './schemas';
import { ItemValidationService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, websockets } = fastify;

  const validationService = resolveDependency(ItemValidationService);
  const publishService = resolveDependency(ItemPublishedService);

  // get validation status of given itemId
  fastify.get<{ Params: { itemId: string } }>(
    '/:itemId/validations/latest',
    {
      schema: itemValidation,

      preHandler: isAuthenticated,
    },
    async ({ user, params: { itemId } }) => {
      const member = notUndefined(user?.member);
      return validationService.getLastItemValidationGroupForItem(
        member,
        buildRepositories(),
        itemId,
      );
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
      preHandler: isAuthenticated,
    },
    async (request, reply) => {
      const {
        user,
        params: { itemId },
        log,
      } = request;
      const member = notUndefined(user?.member);
      // we do not wait
      db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        const { item, hasValidationSucceeded } = await validationService.post(
          member,
          repositories,
          itemId,
        );

        if (hasValidationSucceeded) {
          // publish automatically the item if it is valid.
          // private item will be set to public automatically (should ask the user on the frontend).
          await publishService.publishIfNotExist(member, repositories, itemId);
        }

        // the process could take long time, so let the process run in the background and return the itemId instead

        websockets.publish(
          memberItemsTopic,
          member.id,
          ItemOpFeedbackEvent('validate', [itemId], { [item.id]: item }),
        );
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
