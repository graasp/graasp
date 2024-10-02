import { Type } from '@sinclair/typebox';

import { customType } from '../../../../plugins/typebox';
import { entityIdSchemaRef } from '../../../../schemas/global';
import { itemSchemaRef, packedItemSchemaRef } from '../../schema';

export default {
  $id: 'https://graasp.org/recycle-bin/',
  definitions: {
    // item properties to be returned to the client
    recycledItem: {
      type: 'object',
      required: ['id', 'item'],
      properties: {
        id: customType.UUID(),
        item: itemSchemaRef,
        creator: { $ref: 'https://graasp.org/members/#/definitions/member' },
        createdAt: { type: 'string' },
      },
      additionalProperties: false,
    },
    packedRecycledItem: {
      type: 'object',
      required: ['id', 'item'],
      properties: {
        id: customType.UUID(),
        item: packedItemSchemaRef,
        creator: { $ref: 'https://graasp.org/members/#/definitions/member' },
        createdAt: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
};

// schema for getting recycled items
export const getRecycledItemDatas = {
  response: {
    200: {
      type: 'array',
      items: { $ref: 'https://graasp.org/recycle-bin/#/definitions/packedRecycledItem' },
    },
  },
};

// schema for deleting one item
export const deleteOne = {
  params: entityIdSchemaRef,
  response: {
    200: { $ref: 'https://graasp.org/recycle-bin/#/definitions/recycledItem' },
  },
};

// schema for recycling >1 items
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const recycleMany = (maxItems: number) => ({
  querystring: Type.Object({ id: Type.Array(customType.UUID(), { uniqueItems: true, maxItems }) }),
  response: {
    202: {
      // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
      type: 'array',
      items: customType.UUID(),
    },
  },
});
// schema for restoring>1 items
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const restoreMany = (maxItems: number) => ({
  querystring: Type.Object({ id: Type.Array(customType.UUID(), { uniqueItems: true, maxItems }) }),

  response: {
    202: {
      // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
      type: 'array',
      items: customType.UUID(),
    },
  },
});
// schema for restoring>1 items
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const deleteMany = (maxItems: number) => ({
  querystring: Type.Object({ id: Type.Array(customType.UUID(), { uniqueItems: true, maxItems }) }),
  response: {
    202: {
      // ids > MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE
      type: 'array',
      items: customType.UUID(),
    },
  },
});
