import { DataSource, In } from 'typeorm';

import fastifyCors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import { IdParam, IdsParams, MemberExtra } from '@graasp/sdk';
import subscriptionsPlugin from 'graasp-plugin-subscriptions';
import thumbnailsPlugin, {
  THUMBNAIL_MIMETYPE,
  buildFilePathWithPrefix,
} from 'graasp-plugin-thumbnails';

import { CannotModifyOtherMembers } from '../../util/graasp-error';
import { Member } from './member';
import common, { deleteOne, getCurrent, getMany, getManyBy, getOne, updateOne } from './schemas';

const controller: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;
  const memberRepository = db.getRepository(Member);

  // get current
  fastify.get('/current', { schema: getCurrent }, async ({ member }) => member);

  // get member
  fastify.get<{ Params: IdParam }>(
    '/:id',
    { schema: getOne },
    async ({ member, params: { id }, log }) => {
      return memberRepository.findOneBy({ id });
    },
  );

  // get members
  fastify.get<{ Querystring: IdsParams }>(
    '/',
    { schema: getMany },
    async ({ member, query: { id: ids }, log }) => {
      return memberRepository.find({ where: { id: In(ids) } });
    },
  );

  // get members by
  fastify.get<{ Querystring: { email: string[] } }>(
    '/search',
    { schema: getManyBy },
    async ({ query: { email: emails } }) => {
      const members = await Promise.all(emails.map(async (e) => {
        const m = await memberRepository.findBy({ email: e });
        return m;
      }));
      return members;
    },
  );

  // update member
  fastify.patch<{ Params: IdParam; Body: Partial<Member> }>(
    '/:id',
    { schema: updateOne },
    async ({ member, params: { id }, body, log }) => {
      // handle partial change
      // question: you can never remove a key?

      // TODO:
      // - check rights
      // check member exists
      // transaction

      const m = await memberRepository.findOneBy({ id });
      const extra = Object.assign({}, body?.extra, m.extra);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return memberRepository.update(id, { name:body.name, email:body.email,extra });
    },
  );

  // delete member
  fastify.delete<{ Params: IdParam }>(
    '/:id',
    { schema: deleteOne },
    async ({ member, params: { id }, log }) => {
      // TODO: check rights, transaction,
      if(member.id===id) {
        throw new CannotModifyOtherMembers(id);
      }
      await memberRepository.delete(id);
      return id;
    },
  );
};

export default controller;
