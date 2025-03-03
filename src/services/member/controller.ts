import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { DEFAULT_LANG } from '@graasp/translations';

import { resolveDependency } from '../../di/utils';
import { db } from '../../drizzle/db';
import { asDefined, assertIsDefined } from '../../utils/assertions';
import { CannotModifyOtherMembers } from '../../utils/errors';
import {
  authenticateEmailChange,
  isAuthenticated,
  optionalIsAuthenticated,
} from '../auth/plugins/passport';
import { matchOne } from '../authorization';
import FileService from '../file/service';
import {
  FILE_METADATA_MAX_PAGE_SIZE,
  FILE_METADATA_MIN_PAGE,
  FILE_METADATA_MIN_PAGE_SIZE,
} from './constants';
import { assertIsMember } from './entities/member';
import { EmailAlreadyTaken } from './error';
import { StorageService } from './plugins/storage/service';
import {
  deleteCurrent,
  getCurrent,
  getOne,
  getStorage,
  getStorageFiles,
  patchChangeEmail,
  postChangeEmail,
  updateCurrent,
  updateOne,
} from './schemas';
import { MemberService } from './service';
import { memberAccountRole } from './strategies/memberAccountRole';

const controller: FastifyPluginAsyncTypebox = async (fastify) => {
  const fileService = resolveDependency(FileService);
  const memberService = resolveDependency(MemberService);
  const storageService = resolveDependency(StorageService);

  // get current
  fastify.get('/current', { schema: getCurrent, preHandler: isAuthenticated }, async ({ user }) => {
    return user?.account;
  });

  // get current member storage and its limits
  fastify.get(
    '/current/storage',
    {
      schema: getStorage,
      preHandler: [isAuthenticated, matchOne(memberAccountRole)],
    },
    async ({ user }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return storageService.getStorageLimits(member, fileService.fileType, db);
    },
  );

  // get current member storage files metadata
  fastify.get(
    '/current/storage/files',
    {
      schema: getStorageFiles,
      preHandler: [isAuthenticated, matchOne(memberAccountRole)],
    },
    async ({ user, query: { page, pageSize } }, reply) => {
      if (
        page < FILE_METADATA_MIN_PAGE ||
        pageSize < FILE_METADATA_MIN_PAGE_SIZE ||
        pageSize > FILE_METADATA_MAX_PAGE_SIZE
      ) {
        return reply.status(StatusCodes.BAD_REQUEST).send();
      }
      const member = asDefined(user?.account);
      assertIsMember(member);
      const storageFilesMetadata = await storageService.getStorageFilesMetadata(
        db,
        member,
        fileService.fileType,
        { page, pageSize },
      );
      return {
        ...storageFilesMetadata,
        pagination: { page, pageSize },
      };
    },
  );

  // get member
  // PUBLIC ENDPOINT
  fastify.get(
    '/:id',
    { schema: getOne, preHandler: optionalIsAuthenticated },
    async ({ params: { id } }) => {
      return memberService.get(db, id);
    },
  );

  // TODO: mobile?? patch member? lang?
  /**
   * @deprecated use PATCH /members/current instead
   */
  // update member
  fastify.patch(
    '/:id',
    { schema: updateOne, preHandler: isAuthenticated },
    async ({ user, params: { id }, body }) => {
      const member = asDefined(user?.account);
      // handle partial change
      // question: you can never remove a key?
      if (member.id !== id) {
        throw new CannotModifyOtherMembers({ id });
      }

      return db.transaction(async (tx) => {
        return memberService.patch(tx, id, body);
      });
    },
  );

  // update current member
  fastify.patch(
    '/current',
    { schema: updateCurrent, preHandler: isAuthenticated },
    async ({ user, body }) => {
      const member = asDefined(user?.account);

      return db.transaction(async (tx) => {
        return memberService.patch(tx, member.id, body);
      });
    },
  );

  // delete current member
  fastify.delete(
    '/current',
    { schema: deleteCurrent, preHandler: isAuthenticated },
    async (request, reply) => {
      const { user } = request;
      const member = asDefined(user?.account);
      return db.transaction(async (tx) => {
        await memberService.deleteCurrent(member.id, tx);
        // logout member
        request.logOut();
        // remove session from browser
        request.session.delete();
        reply.status(StatusCodes.NO_CONTENT);
      });
    },
  );

  fastify.post(
    '/current/email/change',
    {
      schema: postChangeEmail,
      preHandler: [isAuthenticated, matchOne(memberAccountRole)],
    },
    async ({ user, body: { email } }, reply) => {
      const account = asDefined(user?.account);
      assertIsMember(account);

      reply.status(StatusCodes.NO_CONTENT);
      // check if there is a member that already has the new email
      if (await memberService.getByEmail(db, email)) {
        // Email adress is already taken, throw an error
        throw new EmailAlreadyTaken();
      }

      // HACK: re-fetch the member from the repo to have it in full (so the types match)
      const member = await memberService.get(db, account.id);
      assertIsDefined(member);
      const token = memberService.createEmailChangeRequest(member, email);
      memberService.sendEmailChangeRequest(email, token, member.extra.lang ?? DEFAULT_LANG);
    },
  );

  fastify.patch(
    '/current/email/change',
    {
      schema: patchChangeEmail,
      preHandler: [authenticateEmailChange, matchOne(memberAccountRole)],
    },
    async ({ user }, reply) => {
      const emailModification = asDefined(user?.emailChange);
      const account = asDefined(user?.account);
      assertIsMember(account);

      await db.transaction(async (tx) => {
        if (await memberService.getByEmail(tx, emailModification.newEmail)) {
          // Email adress is already taken, throw an error
          throw new EmailAlreadyTaken();
        }
        const newMember = await memberService.patch(tx, account.id, {
          email: emailModification.newEmail,
        });

        // we send the email asynchronously without awaiting
        memberService.mailConfirmEmailChangeRequest(
          // HACK: The email should always be defined, but the types on the db are weak
          newMember.email!,
          emailModification.newEmail,
          newMember.extra.lang ?? DEFAULT_LANG,
        );
      });
      // this needs to be outside the transaction
      return reply.status(StatusCodes.NO_CONTENT).send();
    },
  );
};

export default controller;
