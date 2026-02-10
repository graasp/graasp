import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { EtherpadPermission } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { itemCommonSchema } from '../../common.schemas';

const readerPermissionType = Type.Union([
  Type.Literal(EtherpadPermission.Read),
  Type.Literal(EtherpadPermission.Write),
]);

const etherpadItemSchema = Type.Composite([
  itemCommonSchema,
  customType.StrictObject(
    {
      type: Type.Literal('etherpad'),
      extra: customType.StrictObject({
        etherpad: customType.StrictObject({
          padID: Type.String(),
          groupID: Type.String(),
          readerPermission: Type.Optional(readerPermissionType),
        }),
      }),
    },
    {
      title: 'Etherpad Item',
      description: 'Item of type Etherpad.',
    },
  ),
]);

export const etherpadItemSchemaRef = registerSchemaAsRef(
  'etherpadItem',
  'Etherpad Item',
  etherpadItemSchema,
);

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
    readerPermission: Type.Optional(readerPermissionType),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
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
  description: 'Update etherpad properties, including permission of readers.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  body: Type.Partial(
    Type.Composite(
      [
        Type.Pick(etherpadItemSchema, ['name', 'description', 'lang', 'settings']),
        customType.StrictObject({
          readerPermission: readerPermissionType,
        }),
      ],
      { additionalProperties: false },
    ),
    { minProperties: 1 },
  ),
  response: { [StatusCodes.NO_CONTENT]: Type.Null(), '4xx': errorSchemaRef },
} as const satisfies FastifySchema;
