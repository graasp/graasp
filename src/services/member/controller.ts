import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { IdParam, IdsParams } from '@graasp/sdk';

import { buildRepositories } from '../../utils/repositories';
import { Member } from './entities/member';
import { deleteOne, getCurrent, getMany, getManyBy, getOne, updateOne } from './schemas';

const controller: FastifyPluginAsync = async (fastify) => {
  const {
    db,
    members: { service: memberService },
  } = fastify;

  // get current
  fastify.get(
    '/current',
    { schema: getCurrent, preHandler: fastify.verifyAuthentication },
    async ({ member }) => member,
  );

  // get member
  // PUBLIC ENDPOINT
  fastify.get<{ Params: IdParam }>(
    '/:id',
    { schema: getOne },
    async ({ member, params: { id }, log }) => {
      return memberService.get(member, buildRepositories(), id);
    },
  );

  // get members
  // PUBLIC ENDPOINT
  fastify.get<{ Querystring: IdsParams }>(
    '/',
    {
      schema: getMany,
    },
    async ({ member, query: { id: ids }, log }) => {
      return memberService.getMany(member, buildRepositories(), ids);
    },
  );

  // get members by
  // PUBLIC ENDPOINT
  fastify.get<{ Querystring: { email: string[] } }>(
    '/search',
    {
      schema: getManyBy,
    },
    async ({ member, query: { email: emails } }) => {
      return memberService.getManyByEmail(member, buildRepositories(), emails);
    },
  );

  // update member
  fastify.patch<{ Params: IdParam; Body: Partial<Member> }>(
    '/:id',
    { schema: updateOne, preHandler: fastify.verifyAuthentication },
    async ({ member, params: { id }, body, log }) => {
      // handle partial change
      // question: you can never remove a key?

      return db.transaction(async (manager) => {
        return memberService.patch(member, buildRepositories(manager), id, body);
      });
    },
  );

  // delete member
  fastify.delete<{ Params: IdParam }>(
    '/:id',
    { schema: deleteOne, preHandler: fastify.verifyAuthentication },
    async ({ member, params: { id } }, reply) => {
      return db.transaction(async (manager) => {
        await memberService.deleteOne(member, buildRepositories(manager), id);
        reply.status(StatusCodes.NO_CONTENT);
      });
    },
  );
};

export default controller;
