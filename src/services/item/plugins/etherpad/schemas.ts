import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { PermissionLevel } from '@graasp/sdk';

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

export const updateEtherpad = {
  operationId: 'updateEtherpad',
  tags: ['item'],
  summary: 'Update etherpad',
  description: 'Update etherpad permission of readers.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  body: customType.StrictObject({
    readerPermission: Type.Union([
      Type.Literal(PermissionLevel.Read),
      Type.Literal(PermissionLevel.Write),
    ]),
  }),
  response: { [StatusCodes.NO_CONTENT]: Type.Null(), '4xx': errorSchemaRef },
} as const satisfies FastifySchema;
