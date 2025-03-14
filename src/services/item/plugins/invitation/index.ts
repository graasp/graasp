import { StatusCodes } from 'http-status-codes';

import { fastifyMultipart } from '@fastify/multipart';
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import fp from 'fastify-plugin';

import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { FastifyInstanceTypebox } from '../../../../plugins/typebox.js';
import { isNonEmptyArray } from '../../../../types.js';
import { asDefined } from '../../../../utils/assertions.js';
import {
  isAuthenticated,
  matchOne,
  optionalIsAuthenticated,
} from '../../../auth/plugins/passport/index.js';
import { assertIsMember } from '../../../authentication.js';
import { memberAccountRole } from '../../../member/strategies/memberAccountRole.js';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole.js';
import { MAX_FILE_SIZE } from './constants.js';
import { NoFileProvidedForInvitations, NoInvitationReceivedFound } from './errors.js';
import {
  deleteOne,
  getById,
  getForItem,
  invite,
  inviteFromCSV,
  inviteFromCSVWithTemplate,
  sendOne,
  updateOne,
} from './schema.js';
import { InvitationService } from './service.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const invitationService = resolveDependency(InvitationService);

  // register multipart plugin for use in the invitations API

  // get an invitation by id
  // does not require authentication
  fastify.get(
    '/invitations/:id',
    { schema: getById, preHandler: optionalIsAuthenticated },
    async ({ user, params }) => {
      const { id } = params;
      return await invitationService.get(db, user?.account, id);
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

      await db.transaction(async (tx) => {
        await invitationService.shareItem(tx, member, params.id, invitations);
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

        await db.transaction(
          async (tx) =>
            await invitationService.createStructureForCSVAndTemplate(
              tx,
              member,
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
        await db.transaction(
          async (tx) =>
            await invitationService.importUsersWithCSV(tx, member, itemId, uploadedFile),
        );
      },
    );
  });

  // get all invitations for an item
  fastify.get(
    '/:id/invitations',
    {
      schema: getForItem,
      preHandler: [isAuthenticated, matchOne(memberAccountRole)],
    },
    async ({ user, params: { id: itemId } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return invitationService.getForItem(db, member, itemId);
    },
  );

  // update invitation
  fastify.patch(
    '/:id/invitations/:invitationId',
    {
      schema: updateOne,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params: { invitationId }, body }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return db.transaction(async (tx) => {
        return invitationService.patch(tx, member, invitationId, body);
      });
    },
  );

  // delete invitation
  fastify.delete(
    '/:id/invitations/:invitationId',
    {
      schema: deleteOne,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params: { invitationId } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      await db.transaction(async (tx) => {
        await invitationService.delete(tx, member, invitationId);
      });
      return invitationId;
    },
  );

  // resend invitation mail
  fastify.post(
    '/:id/invitations/:invitationId/send',
    {
      schema: sendOne,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async ({ user, params: { invitationId } }, reply) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      await invitationService.resend(db, member, invitationId);
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default fp(plugin, {
  fastify: '4.x',
  name: 'graasp-plugin-invitations',
});
