import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { itemSchemaRef } from '../../schemas';

export const createEtherpad = {
  operationId: 'createEtherpad',
  tags: ['item', 'etherpad'],
  summary: 'Create etherpad',
  description: 'Create an etherpad item.',

  querystring: customType.StrictObject({
    parentId: Type.Optional(customType.UUID()),
  }),
  body: customType.StrictObject({
    name: customType.ItemName(),
  }),
  response: {
    [StatusCodes.OK]: itemSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getEtherpadFromItem = {
  operationId: 'getEtherpadFromItem',
  tags: ['item', 'etherpad'],
  summary: 'Get etherpad information',
  description: 'Get etherpad information from item id',

  querystring: customType.StrictObject({
    mode: Type.Optional(customType.EnumString(['read', 'write'])),
  }),
  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: customType.StrictObject(
      { padUrl: Type.String() },
      {
        description: 'Successful Response',
      },
    ),
    '4xx': errorSchemaRef,
  },
};
