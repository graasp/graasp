import { Type } from '@sinclair/typebox';

import { customType } from '../../../../../plugins/typebox';

export default {
  $id: 'https://graasp.org/apps/app-settings/',
  definitions: {
    appSetting: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        item: {
          $ref: 'https://graasp.org/items/#/definitions/item',
        },
        data: {},
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
    required: ['data', 'name'],
    properties: {
      data: { type: 'object', additionalProperties: true },
      name: { type: 'string' },
    },
  },
  response: {
    200: { $ref: 'https://graasp.org/apps/app-settings/#/definitions/appSetting' },
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
    200: { $ref: 'https://graasp.org/apps/app-settings/#/definitions/appSetting' },
  },
};

const deleteOne = {
  params: Type.Object({
    itemId: customType.UUID(),
    id: customType.UUID(),
  }),
  response: {
    200: { $ref: 'https://graasp.org/apps/app-settings/#/definitions/appSetting' },
  },
};

const getForOne = {
  params: Type.Object({
    itemId: customType.UUID(),
  }),
  querystring: {
    type: 'object',
    properties: {
      name: { type: 'string' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'array',
      items: { $ref: 'https://graasp.org/apps/app-settings/#/definitions/appSetting' },
    },
  },
};

export { create, updateOne, deleteOne, getForOne };
