import { UUID_REGEX } from '../../../../../schemas/global';

export default {
  $id: 'https://graasp.org/apps/app-data/',
  definitions: {
    appData: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        account: { $ref: 'https://graasp.org/accounts/#/definitions/account' },
        item: { $ref: 'https://graasp.org/items/#/definitions/item' },
        data: {
          type: 'object',
          additionalProperties: true,
        },
        type: { type: 'string' },
        visibility: { type: 'string' }, // TODO: should we always return this
        creator: { $ref: 'https://graasp.org/members/#/definitions/member' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
  },
};

const create = {
  params: { $ref: 'https://graasp.org/apps/#/definitions/itemIdParam' },
  body: {
    type: 'object',
    required: ['data', 'type'],
    properties: {
      data: { type: 'object', additionalProperties: true },
      type: { type: 'string', minLength: 3, maxLength: 25 },
      visibility: { type: 'string', enum: ['member', 'item'] },
      accountId: { $ref: 'https://graasp.org/#/definitions/uuid' },
    },
  },
  response: {
    200: { $ref: 'https://graasp.org/apps/app-data/#/definitions/appData' },
  },
};

const updateOne = {
  params: {
    allOf: [
      { $ref: 'https://graasp.org/apps/#/definitions/itemIdParam' },
      { $ref: 'https://graasp.org/#/definitions/idParam' },
    ],
  },
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
};

const deleteOne = {
  params: {
    allOf: [
      { $ref: 'https://graasp.org/apps/#/definitions/itemIdParam' },
      { $ref: 'https://graasp.org/#/definitions/idParam' },
    ],
  },
  response: {
    200: { $ref: 'https://graasp.org/apps/app-data/#/definitions/appData' },
  },
};

const getForOne = {
  params: { $ref: 'https://graasp.org/apps/#/definitions/itemIdParam' },
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
};

const getForMany = {
  querystring: {
    type: 'object',
    required: ['itemId'],
    properties: {
      itemId: {
        type: 'array',
        items: { $ref: 'https://graasp.org/#/definitions/uuid' },
        uniqueItems: true,
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      additionalProperties: false,
      properties: {
        data: {
          type: 'object',
          patternProperties: {
            [UUID_REGEX]: {
              type: 'array',
              items: { $ref: 'https://graasp.org/apps/app-data/#/definitions/appData' },
            },
          },
        },
        errors: {
          type: 'array',
          items: {
            $ref: 'https://graasp.org/#/definitions/error',
          },
        },
      },
    },
  },
};

export { create, updateOne, deleteOne, getForOne, getForMany };
