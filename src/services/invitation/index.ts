import { StatusCodes } from 'http-status-codes';

import fastifyMultipart from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { HttpMethod } from '@graasp/sdk';

import { IdParam } from '../../types';
import { Repositories, buildRepositories } from '../../utils/repositories';
import { Actor, Member } from '../member/entities/member';
import { MAX_FILES, MAX_FILE_SIZE, MAX_NON_FILE_FIELDS } from './constants';
import { NoFileProvidedForInvitations } from './errors';
import { Invitation } from './invitation';
import definitions, { deleteOne, getById, getForItem, invite, sendOne, updateOne } from './schema';
import { InvitationService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { mailer, db, log, members, items } = fastify;

  if (!mailer) {
    throw new Error('Mailer plugin is not defined');
  }

  fastify.addSchema(definitions);

  const iS = new InvitationService(log, mailer, items.service, members.service);

  // post hook: remove invitations on member creation
  const hook = async (actor: Actor, repositories: Repositories, args: { member: Member }) => {
    const { email } = args.member;
    await iS.createToMemberships(actor, repositories, args.member);
    await repositories.invitationRepository.deleteForEmail(email);
  };
  members.service.hooks.setPostHook('create', hook);

  // get an invitation by id
  // do not require authentication
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
        return iS.postManyForItem(member, buildRepositories(manager), params.id, body.invitations);
      });
    },
  );

  fastify.register(fastifyMultipart, {
    limits: {
      fields: MAX_NON_FILE_FIELDS, // Max number of non-file fields (Default: Infinity).
      fileSize: MAX_FILE_SIZE, // For multipart forms, the max file size (Default: Infinity).
      files: MAX_FILES, // Max number of file fields (Default: Infinity).
    },
  });

  // post invitations from a csv file
  fastify.post<{ Querystring: IdParam & { template_id: string } }>(
    '/:id/invitations/upload-csv',
    { preHandler: fastify.verifyAuthentication },
    async ({ member, query, file }) => {
      // We need to get the membership service here because it is defined after the invitation service
      const { memberships } = fastify;
      // get uploaded file
      const uploadedFile = await file();

      if (!uploadedFile) {
        throw new NoFileProvidedForInvitations();
      }

      return await db.transaction(async (manager) =>
        iS.handleCSVInvitations(
          member,
          buildRepositories(manager),
          query,
          uploadedFile,
          memberships.service,
        ),
      );
    },
  );

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
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default fp(plugin, {
  fastify: '4.x',
  name: 'graasp-plugin-invitations',
});
