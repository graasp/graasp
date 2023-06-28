export default {
  $id: 'http://graasp.org/itemlikes/',
  definitions: {
    itemLike: {
      type: 'object',
      properties: {
        id: {
          $ref: 'http://graasp.org/#/definitions/uuid',
        },
        item: {
          $ref: 'http://graasp.org/items/#/definitions/item',
        },
        creator: {
          $ref: 'http://graasp.org/member/#/definitions/member',
        },
        createdAt: {},
      },
      additionalProperties: false,
    },
    likeCount: {
      type: 'number',
      additionalProperties: false,
    },
  },
};

export const getLikesForMember = {
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
        $ref: 'http://graasp.org/itemlikes/#/definitions/itemLike',
      },
    },
  },
};

export const getLikesForItem = {
  params: {
    itemId: { $ref: 'http://graasp.org/#/definitions/uuid' },
  },
  response: {
    200: {
      type: 'array',
      items: {
        $ref: 'http://graasp.org/itemlikes/#/definitions/itemLike',
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
      $ref: 'http://graasp.org/itemlikes/#/definitions/itemLike',
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
