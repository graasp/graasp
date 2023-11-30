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
        item: { $ref: 'http://graasp.org/items/#/definitions/item' },
        members: {
          type: 'array',
          items: {
            $ref: 'http://graasp.org/members/#/definitions/member',
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
