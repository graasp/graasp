import { customType } from '../../../../plugins/typebox';
import { itemSchemaRef, packedItemSchemaRef } from '../../schema';

export default {
  $id: 'https://graasp.org/favorite/',
  definitions: {
    favorite: {
      type: 'object',
      properties: {
        id: {
          $ref: 'https://graasp.org/#/definitions/uuid',
        },
        item: itemSchemaRef,
        createdAt: { type: 'string' },
      },
      additionalProperties: false,
    },
    packedFavorite: {
      type: 'object',
      properties: {
        id: {
          $ref: 'https://graasp.org/#/definitions/uuid',
        },
        item: packedItemSchemaRef,
        createdAt: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
};

export const getFavorite = {
  querystring: {
    type: 'object',
    properties: {
      memberId: customType.UUID(),
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'array',
      items: {
        $ref: 'https://graasp.org/favorite/#/definitions/packedFavorite',
      },
    },
  },
};

export const create = {
  params: {
    itemId: customType.UUID(),
  },
  response: {
    200: {
      $ref: 'https://graasp.org/favorite/#/definitions/favorite',
    },
  },
};

export const deleteOne = {
  params: {
    itemId: customType.UUID(),
  },
  response: {
    200: customType.UUID(),
  },
};
