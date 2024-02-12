import { UUID_REGEX } from '../../../../../schemas/global';

export default {
  $id: 'https://graasp.org/apps/app-action/',
  definitions: {
    appAction: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        member: {
          $ref: 'https://graasp.org/members/#/definitions/member',
        },
        item: {
          $ref: 'https://graasp.org/items/#/definitions/item',
        },
        data: {},
        type: { type: 'string' },
        createdAt: { type: 'string' },
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
      memberId: { $ref: 'https://graasp.org/#/definitions/uuid' },
    },
  },
  response: {
    200: { $ref: 'https://graasp.org/apps/app-action/#/definitions/appAction' },
  },
};

const getForOne = {
  params: { $ref: 'https://graasp.org/apps/#/definitions/itemIdParam' },
  querystring: {
    type: 'object',
    properties: {
      memberId: { $ref: 'https://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'array',
      items: { $ref: 'https://graasp.org/apps/app-action/#/definitions/appAction' },
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
      memberId: { $ref: 'https://graasp.org/#/definitions/uuid' },
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
              items: { $ref: 'https://graasp.org/apps/app-action/#/definitions/appAction' },
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

export { create, getForOne, getForMany };
