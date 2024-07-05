import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { resolveDependency } from '../../di/utils';
import { IdParam, IdsParams } from '../../types';
import { notUndefined } from '../../utils/assertions';
import { CannotModifyOtherMembers } from '../../utils/errors';
import { buildRepositories } from '../../utils/repositories';
import {
  authenticateEmailChange,
  isAuthenticated,
  optionalIsAuthenticated,
} from '../auth/plugins/passport';
import FileService from '../file/service';
import { Member } from './entities/member';
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
  patchChangeEmail,
  postChangeEmail,
  updateOne,
} from './schemas';
import { MemberService } from './service';

const controller: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;
  const fileService = resolveDependency(FileService);
  const memberService = resolveDependency(MemberService);
  const storageService = resolveDependency(StorageService);

  // get current
  fastify.get('/current', { schema: getCurrent, preHandler: isAuthenticated }, async ({ user }) => {
    return user?.member;
  });

  // get current member storage and its limits
  fastify.get(
    '/current/storage',
    { schema: getStorage, preHandler: isAuthenticated },
    async ({ user }) => {
      const member = notUndefined(user?.member);
      return storageService.getStorageLimits(member, fileService.fileType, buildRepositories());
    },
  );

  // get member
  // PUBLIC ENDPOINT
  fastify.get<{ Params: IdParam }>(
    '/:id',
    { schema: getOne, preHandler: optionalIsAuthenticated },
    async ({ user, params: { id } }) => {
      return memberService.get(user?.member, buildRepositories(), id);
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
    async ({ user, query: { id: ids } }) => {
      return memberService.getMany(user?.member, buildRepositories(), ids);
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
    async ({ user, query: { email: emails } }) => {
      return memberService.getManyByEmail(user?.member, buildRepositories(), emails);
    },
  );

  // update member
  fastify.patch<{ Params: IdParam; Body: Partial<Member> }>(
    '/:id',
    { schema: updateOne, preHandler: isAuthenticated },
    async ({ user, params: { id }, body }) => {
      const member = notUndefined(user?.member);
      // handle partial change
      // question: you can never remove a key?
      if (member.id !== id) {
        throw new CannotModifyOtherMembers(id);
      }

      return db.transaction(async (manager) => {
        return memberService.patch(buildRepositories(manager), id, body);
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
      return db.transaction(async (manager) => {
        await memberService.deleteOne(user?.member, buildRepositories(manager), id);
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
      const member = notUndefined(user?.member);
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
    { schema: postChangeEmail, preHandler: isAuthenticated },
    async ({ user, body: { email } }, reply) => {
      const member = notUndefined(user?.member);
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
    { schema: patchChangeEmail, preHandler: authenticateEmailChange },
    async ({ user }, reply) => {
      const emailModification = notUndefined(user?.emailChange);
      const member = notUndefined(user?.member);

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
