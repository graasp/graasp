export default {
  $id: 'http://graasp.org/favorite/',
  definitions: {
    favorite: {
      type: 'object',
      properties: {
        id: {
          $ref: 'http://graasp.org/#/definitions/uuid',
        },
        item: {
          $ref: 'http://graasp.org/items/#/definitions/item',
        },
        createdAt: {},
      },
      additionalProperties: false,
    },
  },
};

export const getFavorite = {
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
      items: {
        $ref: 'http://graasp.org/favorite/#/definitions/favorite',
      },
    },
  },
};

export const create = {
  params: {
    itemId: { $ref: 'http://graasp.org/#/definitions/uuid' },
  },
  response: {
    200: {
      $ref: 'http://graasp.org/favorite/#/definitions/favorite',
    },
  },
};

export const deleteOne = {
  params: {
    itemId: { $ref: 'http://graasp.org/#/definitions/uuid' },
  },
  response: {
    200: { $ref: 'http://graasp.org/#/definitions/uuid' },
  },
};
