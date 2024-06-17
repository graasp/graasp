import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { IdParam, IdsParams } from '../../types';
import { notUndefined } from '../../utils/assertions';
import { buildRepositories } from '../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../auth/plugins/passport';
import { Member } from './entities/member';
import {
  deleteOne,
  getCurrent,
  getMany,
  getManyBy,
  getOne,
  getStorage,
  updateOne,
} from './schemas';

const controller: FastifyPluginAsync = async (fastify) => {
  const {
    db,
    members: { service: memberService },
    storage: { service: storageService },
    files: { service: fileService },
  } = fastify;

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
      return storageService.getStorageLimits(member, fileService.type, buildRepositories());
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
      // handle partial change
      // question: you can never remove a key?

      return db.transaction(async (manager) => {
        return memberService.patch(user?.member, buildRepositories(manager), id, body);
      });
    },
  );

  // delete member
  fastify.delete<{ Params: IdParam }>(
    '/:id',
    { schema: deleteOne, preHandler: isAuthenticated },
    async ({ user, params: { id } }, reply) => {
      return db.transaction(async (manager) => {
        await memberService.deleteOne(user?.member, buildRepositories(manager), id);
        reply.status(StatusCodes.NO_CONTENT);
      });
    },
  );
};

export default controller;
