import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { UnauthorizedMember } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
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
    async ({ member, params: { itemId }, log }) => {
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
    async ({ member, params: { itemValidationGroupId }, log }) => {
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
    async ({ member, params: { itemId }, log }, reply) => {
      // we do not wait
      db.transaction(async (manager) => {
        if (!member) {
          throw new UnauthorizedMember();
        }
        await validationService.post(member, buildRepositories(manager), itemId);

        // the process could take long time, so let the process run in the background and kreturn the itemId instead
      }).catch((e) => {
        // TODO: return feedback in queue
        console.error(e);
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
