export default {
  $id: 'http://graasp.org/itemlikes/',
  definitions: {
    itemLike: {
      type: 'object',
      properties: {
        id: {
          $ref: 'http://graasp.org/#/definitions/uuid',
        },
        itemId: {
          $ref: 'http://graasp.org/#/definitions/uuid',
        },
        memberId: {
          $ref: 'http://graasp.org/#/definitions/uuid',
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

export const getLikedItems = {
  params: {
    memberId: { $ref: 'http://graasp.org/#/definitions/uuid' },
  },
  response: {
    200: {
      type: 'array',
    },
  },
};

export const getLikeCount = {
  params: {
    itemId: { $ref: 'http://graasp.org/#/definitions/uuid' },
  },
  response: {
    200: {
      $ref: 'http://graasp.org/itemlikes/#/definitions/likeCount',
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
