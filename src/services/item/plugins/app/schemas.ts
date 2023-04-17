export default {
  $id: 'http://graasp.org/apps/',
  definitions: {
    itemIdParam: {
      type: 'object',
      required: ['itemId'],
      properties: {
        itemId: { $ref: 'http://graasp.org/#/definitions/uuid' },
      },
    },

    appContext: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        path: { type: 'string' },
        description: { type: 'string' },
        type: { type: 'string' },
        extra: {},
        members: {
          type: 'array',
          items: {
            $ref: 'http://graasp.org/members/#/definitions/member',
          },
        },
        children: {
          type: 'array',
          items: {
            $ref: 'http://graasp.org/items/#/definitions/item',
          },
        },
      },
    },
  },
};

const generateToken = {
  params: { $ref: 'http://graasp.org/apps/#/definitions/itemIdParam' },
  body: {
    type: 'object',
    required: ['key', 'origin'],
    properties: {
      key: { $ref: 'http://graasp.org/#/definitions/uuid' },
      origin: { type: 'string', format: 'url' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: { token: { type: 'string' } },
    },
  },
};

const getContext = {
  params: { $ref: 'http://graasp.org/apps/#/definitions/itemIdParam' },
  response: {
    200: { $ref: 'http://graasp.org/apps/#/definitions/appContext' },
  },
};
const patchSettings = {
  params: { $ref: 'http://graasp.org/apps/#/definitions/itemIdParam' },
  body: {
    type: 'object',
    additionalProperties: true,
  },
  response: {
    204: {},
  },
};

export { generateToken, getContext, patchSettings };
