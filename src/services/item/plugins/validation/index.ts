import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { UnauthorizedMember } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import { ItemOpFeedbackEvent, memberItemsTopic } from '../../ws/events';
import { itemValidation, itemValidationGroup } from './schemas';
import { ItemValidationService } from './service';

type GraaspPluginValidationOptions = {
  imageClassifierApi?: string;
};

const plugin: FastifyPluginAsync<GraaspPluginValidationOptions> = async (fastify, options) => {
  const {
    items: { service: iS },
    db,
    files: { service: fileService },
    websockets,
  } = fastify;

  const { imageClassifierApi } = options;

  const validationService = new ItemValidationService(iS, fileService, imageClassifierApi);

  // get validation status of given itemId
  fastify.get<{ Params: { itemId: string } }>(
    '/:itemId/validations/latest',
    {
      schema: itemValidation,

      preHandler: fastify.verifyAuthentication,
    },
    async ({ member, params: { itemId } }) => {
      if (!member) {
        throw new UnauthorizedMember();
      }
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
      preHandler: fastify.verifyAuthentication,
    },
    async ({ member, params: { itemValidationGroupId } }) => {
      if (!member) {
        throw new UnauthorizedMember();
      }
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
      preHandler: fastify.verifyAuthentication,
    },
    async (request, reply) => {
      const {
        member,
        params: { itemId },
        log,
      } = request;
      // we do not wait
      db.transaction(async (manager) => {
        if (!member) {
          throw new UnauthorizedMember();
        }
        const repositories = buildRepositories(manager);
        const item = await validationService.post(member, repositories, itemId);

        // the process could take long time, so let the process run in the background and return the itemId instead
        if (member) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('validate', [itemId], { data: { [item.id]: item }, errors: [] }),
          );
        }
      }).catch((e: Error) => {
        log.error(e);
        if (member) {
          websockets.publish(
            memberItemsTopic,
            member.id,
            ItemOpFeedbackEvent('validate', [itemId], { error: e }),
          );
        }
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
