import { StatusCodes } from 'http-status-codes';

import { fastifyMultipart } from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { resolveDependency } from '../../../../di/utils';
import { MailerService } from '../../../../plugins/mailer/service';
import { EntryNotFoundBeforeDeleteException } from '../../../../repositories/errors';
import { IdParam, isNonEmptyArray } from '../../../../types';
import { asDefined } from '../../../../utils/assertions';
import { Repositories, buildRepositories } from '../../../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../../../auth/plugins/passport';
import { matchOne } from '../../../authorization';
import { Actor, Member, assertIsMember } from '../../../member/entities/member';
import { MemberService } from '../../../member/service';
import { memberAccountRole } from '../../../member/strategies/memberAccountRole';
import { validatedMemberAccountRole } from '../../../member/strategies/validatedMemberAccountRole';
import { MAX_FILE_SIZE } from './constants';
import { Invitation } from './entity';
import { NoFileProvidedForInvitations, NoInvitationReceivedFound } from './errors';
import definitions, { deleteOne, getById, getForItem, invite, sendOne, updateOne } from './schema';
import { InvitationService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;
  const mailerService = resolveDependency(MailerService);
  const memberService = resolveDependency(MemberService);
  const invitationService = resolveDependency(InvitationService);

  if (!mailerService) {
    throw new Error('Mailer plugin is not defined');
  }

  fastify.addSchema(definitions);
  // register multipart plugin for use in the invitations API

  // post hook: remove invitations on member creation
  const hook = async (actor: Actor, repositories: Repositories, args: { member: Member }) => {
    const { email } = args.member;
    await invitationService.createToMemberships(actor, repositories, args.member);
    try {
      await repositories.invitationRepository.deleteByEmail(email);
    } catch (e) {
      if (!(e instanceof EntryNotFoundBeforeDeleteException)) {
        throw e;
      }
    }
  };
  memberService.hooks.setPostHook('create', hook);

  // get an invitation by id
  // does not require authentication
  fastify.get<{ Params: IdParam }>(
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
  fastify.post<{
    Params: IdParam;
    Body: { invitations: Pick<Invitation, 'email' | 'permission'>[] };
  }>(
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

  fastify.register(async (fastify) => {
    fastify.register(fastifyMultipart);

    // post invitations from a csv file
    fastify.post<{ Params: IdParam; Querystring: { templateId: string } }>(
      '/:id/invitations/upload-csv',
      { preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)] },
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

        if (templateId) {
          return await db.transaction(async (manager) =>
            invitationService.createStructureForCSVAndTemplate(
              member,
              buildRepositories(manager),
              itemId,
              templateId,
              uploadedFile,
            ),
          );
        }
        return await db.transaction(async (manager) =>
          invitationService.importUsersWithCSV(
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
  fastify.get<{ Params: IdParam }>(
    '/:id/invitations',
    { schema: getForItem, preHandler: [isAuthenticated, matchOne(memberAccountRole)] },
    async ({ user, params: { id: itemId } }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return invitationService.getForItem(member, buildRepositories(), itemId);
    },
  );

  // update invitation
  fastify.patch<{ Params: { id: string; invitationId: string }; Body: Partial<Invitation> }>(
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
  fastify.delete<{ Params: { id: string; invitationId: string } }>(
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
  fastify.post<{ Params: { id: string; invitationId: string } }>(
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
