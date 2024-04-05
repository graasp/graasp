export default {
  $id: 'https://graasp.org/itemlikes/',
  definitions: {
    itemLike: {
      type: 'object',
      properties: {
        id: {
          $ref: 'https://graasp.org/#/definitions/uuid',
        },
        item: {
          $ref: 'https://graasp.org/items/#/definitions/item',
        },
        // warning: do not include for privacy for now
        // member: {
        //   $ref: 'https://graasp.org/#/definitions/uuid',
        // },
        createdAt: {},
      },
      additionalProperties: false,
    },
    packedIemLike: {
      type: 'object',
      properties: {
        id: {
          $ref: 'https://graasp.org/#/definitions/uuid',
        },
        item: {
          $ref: 'https://graasp.org/items/#/definitions/packedItem',
        },
        // warning: do not include for privacy for now
        // member: {
        //   $ref: 'https://graasp.org/#/definitions/uuid',
        // },
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
      memberId: { $ref: 'https://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'array',
      items: {
        $ref: 'https://graasp.org/itemlikes/#/definitions/packedIemLike',
      },
    },
  },
};

export const getLikesForItem = {
  params: {
    itemId: { $ref: 'https://graasp.org/#/definitions/uuid' },
  },
  response: {
    200: {
      type: 'array',
      items: {
        $ref: 'https://graasp.org/itemlikes/#/definitions/itemLike',
      },
    },
  },
};

export const create = {
  params: {
    itemId: { $ref: 'https://graasp.org/#/definitions/uuid' },
  },
  response: {
    200: {
      $ref: 'https://graasp.org/itemlikes/#/definitions/itemLike',
    },
  },
};

export const deleteOne = {
  params: {
    itemId: { $ref: 'https://graasp.org/#/definitions/uuid' },
  },
  response: {
    200: { $ref: 'https://graasp.org/#/definitions/uuid' },
  },
};
