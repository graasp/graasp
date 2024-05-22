import { StatusCodes } from 'http-status-codes';

import fastifyMultipart from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { IdParam } from '../../../../types';
import { UnauthorizedMember } from '../../../../utils/errors';
import { Repositories, buildRepositories } from '../../../../utils/repositories';
import { Actor, Member } from '../../../member/entities/member';
import { MAX_FILE_SIZE } from './constants';
import { Invitation } from './entity';
import { NoFileProvidedForInvitations } from './errors';
import definitions, { deleteOne, getById, getForItem, invite, sendOne, updateOne } from './schema';
import { InvitationService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { mailer, db, log, members, items, memberships } = fastify;

  if (!mailer) {
    throw new Error('Mailer plugin is not defined');
  }

  fastify.addSchema(definitions);
  // register multipart plugin for use in the invitations API

  const iS = new InvitationService(
    log,
    mailer,
    items.service,
    members.service,
    memberships.service,
  );

  // post hook: remove invitations on member creation
  const hook = async (actor: Actor, repositories: Repositories, args: { member: Member }) => {
    const { email } = args.member;
    await iS.createToMemberships(actor, repositories, args.member);
    await repositories.invitationRepository.deleteForEmail(email);
  };
  members.service.hooks.setPostHook('create', hook);

  // get an invitation by id
  // does not require authentication
  fastify.get<{ Params: IdParam }>(
    '/invitations/:id',
    { schema: getById, preHandler: fastify.attemptVerifyAuthentication },
    async ({ member, params }) => {
      const { id } = params;
      const aa = await iS.get(member, buildRepositories(), id);
      return aa;
    },
  );

  fastify.post<{ Params: IdParam; Body: { invitations: Partial<Invitation>[] } }>(
    '/:id/invite',
    {
      schema: invite,
      preHandler: fastify.verifyAuthentication,
    },
    async ({ member, body, params }) => {
      return db.transaction(async (manager) => {
        const res = await iS.postManyForItem(
          member,
          buildRepositories(manager),
          params.id,
          body.invitations,
        );
        return res;
      });
    },
  );

  await fastify.register(async (fastify) => {
    await fastify.register(fastifyMultipart);

    // post invitations from a csv file
    fastify.post<{ Params: IdParam; Querystring: { templateId: string } }>(
      '/:id/invitations/upload-csv',
      { preHandler: fastify.verifyAuthentication },
      async (request) => {
        const { member, query, params } = request;
        // this is needed to assert the type of the member to be a Member and not an Actor.
        // verifyAuthentication preHandler should throw if there is no member, but the type can not be narrowed automatically
        if (!member) {
          throw new UnauthorizedMember(member);
        }

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

        if (templateId) {
          return await db.transaction(async (manager) =>
            iS.createStructureForCSVAndTemplate(
              member,
              buildRepositories(manager),
              itemId,
              templateId,
              uploadedFile,
            ),
          );
        }
        return await db.transaction(async (manager) =>
          iS.importUsersWithCSV(member, buildRepositories(manager), itemId, uploadedFile),
        );
      },
    );
  });

  // get all invitations for an item
  fastify.get<{ Params: IdParam }>(
    '/:id/invitations',
    { schema: getForItem, preHandler: fastify.verifyAuthentication },
    async ({ member, params }) => {
      const { id: itemId } = params;
      return iS.getForItem(member, buildRepositories(), itemId);
    },
  );

  // update invitation
  fastify.patch<{ Params: { id: string; invitationId: string }; Body: Partial<Invitation> }>(
    '/:id/invitations/:invitationId',
    { schema: updateOne, preHandler: fastify.verifyAuthentication },
    async ({ member, params, body }) => {
      const { invitationId } = params;

      return db.transaction(async (manager) => {
        return iS.patch(member, buildRepositories(manager), invitationId, body);
      });
    },
  );

  // delete invitation
  fastify.delete<{ Params: { id: string; invitationId: string } }>(
    '/:id/invitations/:invitationId',
    { schema: deleteOne, preHandler: fastify.verifyAuthentication },
    async ({ member, params }) => {
      const { invitationId } = params;

      return db.transaction(async (manager) => {
        return iS.delete(member, buildRepositories(manager), invitationId);
      });
    },
  );

  // resend invitation mail
  fastify.post<{ Params: { id: string; invitationId: string } }>(
    '/:id/invitations/:invitationId/send',
    { schema: sendOne, preHandler: fastify.verifyAuthentication },
    async ({ member, params }, reply) => {
      const { invitationId } = params;

      await iS.resend(member, buildRepositories(), invitationId);
      void reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default fp(plugin, {
  fastify: '4.x',
  name: 'graasp-plugin-invitations',
});
