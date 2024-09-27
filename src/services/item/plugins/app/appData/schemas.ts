import { Type } from '@sinclair/typebox';

import { FastifySchema } from 'fastify';

import { customType } from '../../../../../plugins/typebox';
import { accountSchemaRef } from '../../../../account/schemas';

export default {
  $id: 'https://graasp.org/apps/app-data/',
  definitions: {
    appData: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        account: accountSchemaRef,
        /** @deprecated use account - to support legacy apps */
        member: { $ref: accountSchemaRef.$ref, deprecated: true },
        item: { $ref: 'https://graasp.org/items/#/definitions/item' },
        data: {
          type: 'object',
          additionalProperties: true,
        },
        type: { type: 'string' },
        visibility: { type: 'string', enum: ['member', 'item'] },
        creator: { $ref: 'https://graasp.org/members/#/definitions/member' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
  },
};

const create = {
  params: Type.Object({
    itemId: customType.UUID(),
  }),
  body: {
    type: 'object',
    required: ['data', 'type'],
    properties: {
      data: { type: 'object', additionalProperties: true },
      type: { type: 'string', minLength: 3, maxLength: 25 },
      visibility: { type: 'string', enum: ['member', 'item'] },
      /** @deprecated use accountId */
      memberId: customType.UUID({ deprecated: true }),
      accountId: customType.UUID(),
    },
  },
  response: {
    200: { $ref: 'https://graasp.org/apps/app-data/#/definitions/appData' },
  },
};

const updateOne = {
  params: Type.Object({
    itemId: customType.UUID(),
    id: customType.UUID(),
  }),
  body: {
    type: 'object',
    required: ['data'],
    properties: {
      data: { type: 'object', additionalProperties: true },
    },
  },
  response: {
    200: { $ref: 'https://graasp.org/apps/app-data/#/definitions/appData' },
  },
} as const satisfies FastifySchema;

const deleteOne = {
  params: Type.Object({
    itemId: customType.UUID(),
    id: customType.UUID(),
  }),
  response: {
    200: { $ref: 'https://graasp.org/apps/app-data/#/definitions/appData' },
  },
} as const satisfies FastifySchema;

const getForOne = {
  params: Type.Object({
    itemId: customType.UUID(),
  }),
  querystring: {
    type: 'object',
    properties: {
      type: { type: 'string' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'array',
      items: { $ref: 'https://graasp.org/apps/app-data/#/definitions/appData' },
    },
  },
} as const satisfies FastifySchema;

export { create, updateOne, deleteOne, getForOne };
