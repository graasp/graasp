import { DataSource, In } from 'typeorm';

import { FastifyPluginAsync } from 'fastify';

import { Item } from '../entity/Item';
import { Member } from '../entity/Member';

declare module 'fastify' {
  interface FastifyInstance {
    db: DataSource;
  }

  interface FastifyRequest {
    member: Member;
    myPluginProp: string;
  }
  interface FastifyReply {
    myPluginProp: number;
  }
}

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db } = fastify;
  const itemRepository = db.getRepository(Item);
  console.log(itemRepository);

  fastify.register(
    async function (fastify) {
      // create item
      fastify.post<{ Querystring: { parentId?: string } }>(
        '/',
        {},
        async ({ member, query: { parentId }, body, log }) => {
          return itemRepository.save(body);
        },
      );

      // get item
      fastify.get<{ Params: { id: string } }>(
        '/:id',
        {},
        async ({ member, params: { id }, log }) => {
          return itemRepository.findOneBy({ id });
        },
      );

      fastify.get<{ Querystring: { id: string[] } }>(
        '/',
        {},
        async ({ member, query: { id: ids }, log }) => {
          return itemRepository.find({ where: { id: In(ids) } });
        },
      );

      // get item's children
      fastify.get<{ Params: { id: string }; Querystring: { ordered?: boolean } }>(
        '/:id/children',
        {},
        async ({ member, params: { id }, query: { ordered }, log }) => {
          const r = db.getTreeRepository(Item);
          const parentItem = await itemRepository.findOneBy({ id });
          const tree = await r.findDescendantsTree(parentItem, { depth: 1 });
          return tree.children;
        },
      );
    },

    { prefix: '/items' },
  );
};

export default plugin;
