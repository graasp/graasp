export default {
  $id: 'http://graasp.org/apps/app-action/',
  definitions: {
    appAction: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        memberId: { type: 'string' },
        itemId: { type: 'string' },
        data: {},
        type: { type: 'string' },
        createdAt: { type: 'string' },
      },
    },
  },
};

const create = {
  params: { $ref: 'http://graasp.org/apps/#/definitions/itemIdParam' },
  body: {
    type: 'object',
    required: ['data', 'type'],
    properties: {
      data: { type: 'object', additionalProperties: true },
      type: { type: 'string', minLength: 3, maxLength: 25 },
      memberId: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
  },
  response: {
    200: { $ref: 'http://graasp.org/apps/app-action/#/definitions/appAction' },
  },
};

const getForOne = {
  params: { $ref: 'http://graasp.org/apps/#/definitions/itemIdParam' },
  querystring: {
    type: 'object',
    properties: {
      memberId: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'array',
      items: { $ref: 'http://graasp.org/apps/app-action/#/definitions/appAction' },
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
        items: { $ref: 'http://graasp.org/#/definitions/uuid' },
        uniqueItems: true,
      },
      memberId: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'array',
      items: { $ref: 'http://graasp.org/apps/app-action/#/definitions/appAction' },
    },
  },
};

export { create, getForOne, getForMany };
