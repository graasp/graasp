import { FastifyPluginAsync } from 'fastify';

import { ItemType, UnknownExtra } from '@graasp/sdk';

import { createSchema, updateSchema } from './schemas';

export interface DocumentExtra extends UnknownExtra {
  [ItemType.DOCUMENT]: {
    content: string;
  };
}

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    items: { extendCreateSchema, extendExtrasUpdateSchema },
  } = fastify;

  // "install" custom schema for validating document items creation
  extendCreateSchema(createSchema);

  // "install" custom schema for validating document items update
  extendExtrasUpdateSchema(updateSchema);
};

export default plugin;
