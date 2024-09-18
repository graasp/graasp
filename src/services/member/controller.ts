import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { Pagination } from '@graasp/sdk';

import { resolveDependency } from '../../di/utils';
import { IdParam, IdsParams } from '../../types';
import { asDefined } from '../../utils/assertions';
import { CannotModifyOtherMembers } from '../../utils/errors';
import { buildRepositories } from '../../utils/repositories';
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
import { Member, assertIsMember } from './entities/member';
import { EmailAlreadyTaken } from './error';
import { StorageService } from './plugins/storage/service';
import {
  deleteCurrent,
  deleteOne,
  getCurrent,
  getMany,
  getManyBy,
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

const controller: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;
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
    { schema: getStorage, preHandler: [isAuthenticated, matchOne(memberAccountRole)] },
    async ({ user }) => {
      const member = asDefined(user?.account);
      assertIsMember(member);
      return storageService.getStorageLimits(member, fileService.fileType, buildRepositories());
    },
  );

  // get current member storage files metadata
  fastify.get<{ Querystring: Pagination }>(
    '/current/storage/files',
    { schema: getStorageFiles, preHandler: [isAuthenticated, matchOne(memberAccountRole)] },
    async ({ user, query: { page, pageSize } }, reply) => {
      if (
        page < FILE_METADATA_MIN_PAGE ||
        pageSize < FILE_METADATA_MIN_PAGE_SIZE ||
        pageSize > FILE_METADATA_MAX_PAGE_SIZE
      ) {
        reply.status(StatusCodes.BAD_REQUEST).send();
        return;
      }
      const member = asDefined(user?.account);
      assertIsMember(member);
      const storageFilesMetadata = await storageService.getStorageFilesMetadata(
        member,
        buildRepositories(),
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
  fastify.get<{ Params: IdParam }>(
    '/:id',
    { schema: getOne, preHandler: optionalIsAuthenticated },
    async ({ params: { id } }) => {
      return memberService.get(buildRepositories(), id);
    },
  );

  // get members
  // PUBLIC ENDPOINT
  fastify.get<{ Querystring: IdsParams }>(
    '/',
    {
      schema: getMany,
      preHandler: optionalIsAuthenticated,
    },
    async ({ query: { id: ids } }) => {
      return memberService.getMany(buildRepositories(), ids);
    },
  );

  // get members by
  // PUBLIC ENDPOINT
  fastify.get<{ Querystring: { email: string[] } }>(
    '/search',
    {
      schema: getManyBy,
      preHandler: optionalIsAuthenticated,
    },
    async ({ query: { email: emails } }) => {
      return memberService.getManyByEmail(buildRepositories(), emails);
    },
  );

  /**
   * @deprecated use PATCH /members/current instead
   */
  // update member
  fastify.patch<{ Params: IdParam; Body: Partial<Member> }>(
    '/:id',
    { schema: updateOne, preHandler: isAuthenticated },
    async ({ user, params: { id }, body }) => {
      const member = asDefined(user?.account);
      // handle partial change
      // question: you can never remove a key?
      if (member.id !== id) {
        throw new CannotModifyOtherMembers({ id });
      }

      return db.transaction(async (manager) => {
        return memberService.patch(buildRepositories(manager), id, body);
      });
    },
  );

  // update current member
  fastify.patch<{ Body: Partial<Member> }>(
    '/current',
    { schema: updateCurrent, preHandler: isAuthenticated },
    async ({ user, body }) => {
      const member = asDefined(user?.account);

      return db.transaction(async (manager) => {
        return memberService.patch(buildRepositories(manager), member.id, body);
      });
    },
  );

  // delete member
  /**
   * @deprecated use the delete member function without the id param
   */
  fastify.delete<{ Params: IdParam }>(
    '/:id',
    { schema: deleteOne, preHandler: isAuthenticated },
    async (request, reply) => {
      const {
        user,
        params: { id },
      } = request;
      if (!user?.account || user.account.id !== id) {
        throw new CannotModifyOtherMembers({ id });
      }

      return db.transaction(async (manager) => {
        await memberService.deleteOne(buildRepositories(manager), id);
        // logout member
        request.logOut();
        // remove session from browser
        request.session.delete();
        reply.status(StatusCodes.NO_CONTENT);
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
      return db.transaction(async (manager) => {
        await memberService.deleteCurrent(member.id, buildRepositories(manager));
        // logout member
        request.logOut();
        // remove session from browser
        request.session.delete();
        reply.status(StatusCodes.NO_CONTENT);
      });
    },
  );

  fastify.post<{ Body: { email: string } }>(
    '/current/email/change',
    { schema: postChangeEmail, preHandler: [isAuthenticated, matchOne(memberAccountRole)] },
    async ({ user, body: { email } }, reply) => {
      const member = asDefined(user?.account);
      assertIsMember(member);

      reply.status(StatusCodes.NO_CONTENT);
      if (await memberService.getByEmail(buildRepositories(), email)) {
        // Email adress is already taken, throw an error
        throw new EmailAlreadyTaken();
      }

      const token = memberService.createEmailChangeRequest(member, email);
      memberService.sendEmailChangeRequest(email, token, member.lang);
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
      const member = asDefined(user?.account);
      assertIsMember(member);

      await db.transaction(async (manager) => {
        const repositories = buildRepositories(manager);
        if (await memberService.getByEmail(repositories, emailModification.newEmail)) {
          // Email adress is already taken, throw an error
          throw new EmailAlreadyTaken();
        }
        await memberService.patch(repositories, member.id, {
          email: emailModification.newEmail,
        });
        memberService.mailConfirmEmailChangeRequest(
          member.email,
          emailModification.newEmail,
          member.lang,
        );
        return reply.status(StatusCodes.NO_CONTENT).send();
      });
    },
  );
};

export default controller;
