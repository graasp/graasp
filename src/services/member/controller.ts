import { StatusCodes } from 'http-status-codes';

import fastifyPassport from '@fastify/passport';
import { FastifyPluginAsync } from 'fastify';

import { IdParam, IdsParams } from '../../types';
import { buildRepositories } from '../../utils/repositories';
import { authenticated, optionalAuthenticated } from '../auth/plugins/passport';
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
  await fastify.register(fastifyPassport.initialize());
  await fastify.register(fastifyPassport.secureSession());

  // get current
  fastify.get('/current', { schema: getCurrent, preHandler: authenticated }, async ({ user }) => {
    return user;
  });

  // get current member storage and its limits
  fastify.get(
    '/current/storage',
    { schema: getStorage, preHandler: authenticated },
    async ({ user }) => {
      return storageService.getStorageLimits(user!.member!, fileService.type, buildRepositories());
    },
  );

  // get member
  // PUBLIC ENDPOINT
  fastify.get<{ Params: IdParam }>(
    '/:id',
    { schema: getOne, preHandler: optionalAuthenticated },
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
      preHandler: optionalAuthenticated,
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
      preHandler: optionalAuthenticated,
    },
    async ({ user, query: { email: emails } }) => {
      return memberService.getManyByEmail(user?.member, buildRepositories(), emails);
    },
  );

  // update member
  fastify.patch<{ Params: IdParam; Body: Partial<Member> }>(
    '/:id',
    { schema: updateOne, preHandler: authenticated },
    async ({ user, params: { id }, body }) => {
      // handle partial change
      // question: you can never remove a key?

      return db.transaction(async (manager) => {
        return memberService.patch(user!.member!, buildRepositories(manager), id, body);
      });
    },
  );

  // delete member
  fastify.delete<{ Params: IdParam }>(
    '/:id',
    { schema: deleteOne, preHandler: authenticated },
    async ({ user, params: { id } }, reply) => {
      return db.transaction(async (manager) => {
        await memberService.deleteOne(user!.member!, buildRepositories(manager), id);
        reply.status(StatusCodes.NO_CONTENT);
      });
    },
  );
};

export default controller;
