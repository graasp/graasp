import { StatusCodes } from 'http-status-codes';

import { fastifyMultipart } from '@fastify/multipart';
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import fp from 'fastify-plugin';

import { resolveDependency } from '../../../../di/utils';
import { FastifyInstanceTypebox } from '../../../../plugins/typebox';
import { isNonEmptyArray } from '../../../../types';
import { asDefined } from '../../../../utils/assertions';
import { buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { assertIsMember } from '../../../member/entities/member';
import { memberAccountRole } from '../../../member/strategies/memberAccountRole';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { MAX_FILE_SIZE } from './constants';
import { NoFileProvidedForInvitations, NoInvitationReceivedFound } from './errors';
import {
  deleteOne,
  getById,
  getForItem,
  invite,
  inviteFromCSV,
  inviteFromCSVWithTemplate,
  sendOne,
  updateOne,
} from './schema';
import { InvitationService } from './service';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const { db } = fastify;
  const invitationService = resolveDependency(InvitationService);

  // register multipart plugin for use in the invitations API

  // get an invitation by id
  // does not require authentication
  fastify.get(
    '/invitations/:id',
    { schema: getById, preHandler: optionalIsAuthenticated },
    async ({ user, params }) => {
      const { id } = params;
      return await invitationService.get(user?.account, buildRepositories(), id);
    },
  );

  /**
   * Create access rights given received invitations info
   * If the email already exists in the database (a member exists) then a membership is created
   * If the email is not in the database, then we save and send an invitation to this email
   */
  fastify.post(
    '/:id/invite',
    {
      schema: invite,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, body, params }) => {
      const { invitations } = body;
      const member = asDefined(user?.account);
      assertIsMember(member);

      if (!isNonEmptyArray(invitations)) {
        throw new NoInvitationReceivedFound();
      }

      return db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);

        return await invitationService.shareItem(member, repositories, params.id, invitations);
      });
    },
  );

  fastify.register(async (fastify: FastifyInstanceTypebox) => {
    fastify.register(fastifyMultipart);

    // post invitations from a csv file
    fastify.post(
      '/:id/invitations/upload-csv-template',
      {
        schema: inviteFromCSVWithTemplate,
        preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
      },
      async (request) => {
        const { query, params, user } = request;
        const member = asDefined(user?.account);
        assertIsMember(member);

        // get uploaded file
        const uploadedFile = await request.file({
          limits: {
            fields: 0, // Max number of non-file fields (Default: Infinity).
            fileSize: MAX_FILE_SIZE, // For multipart forms, the max file size (Default: Infinity).
            files: 1, // Max number of file fields (Default: Infinity).
          },
        });

        if (!uploadedFile) {
          throw new NoFileProvidedForInvitations();
        }

        // destructure query params
        const { id: itemId } = params;
        const { templateId } = query;

        return await db.transaction(
          async (manager) =>
            await invitationService.createStructureForCSVAndTemplate(
              member,
              buildRepositories(manager),
              itemId,
              templateId,
              uploadedFile,
            ),
        );
      },
    );
    // post invitations from a csv file
    fastify.post(
      '/:id/invitations/upload-csv',
      {
        schema: inviteFromCSV,
        preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
      },
      async (request) => {
        const { params, user } = request;
        const member = asDefined(user?.account);
        assertIsMember(member);

        // get uploaded file
        const uploadedFile = await request.file({
          limits: {
            fields: 0, // Max number of non-file fields (Default: Infinity).
            fileSize: MAX_FILE_SIZE, // For multipart forms, the max file size (Default: Infinity).
            files: 1, // Max number of file fields (Default: Infinity).
          },
        });

        if (!uploadedFile) {
          throw new NoFileProvidedForInvitations();
        }

        // destructure query params
        const { id: itemId } = params;
        return await db.transaction(
          async (manager) =>
            await invitationService.importUsersWithCSV(
              member,
              buildRepositories(manager),
              itemId,
              uploadedFile,
            ),
        );
      },
    );
  });

  // get all invitations for an item
  fastify.get(
    '/:id/invitations',
    { schema: getForItem, preHandler: [isAuthenticated, matchOne(memberAccountRole)] },
    async ({ user, params: { id: itemId } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return invitationService.getForItem(member, buildRepositories(), itemId);
    },
  );

  // update invitation
  fastify.patch(
    '/:id/invitations/:invitationId',
    { schema: updateOne, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async ({ user, params: { invitationId }, body }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return db.transaction(async (manager) => {
        return invitationService.patch(member, buildRepositories(manager), invitationId, body);
      });
    },
  );

  // delete invitation
  fastify.delete(
    '/:id/invitations/:invitationId',
    { schema: deleteOne, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async ({ user, params: { invitationId } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      await db.transaction(async (manager) => {
        await invitationService.delete(member, buildRepositories(manager), invitationId);
      });
      return invitationId;
    },
  );

  // resend invitation mail
  fastify.post(
    '/:id/invitations/:invitationId/send',
    { schema: sendOne, preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
    async ({ user, params: { invitationId } }, reply) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      await invitationService.resend(member, buildRepositories(), invitationId);
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default fp(plugin, {
  fastify: '4.x',
  name: 'graasp-plugin-invitations',
});
