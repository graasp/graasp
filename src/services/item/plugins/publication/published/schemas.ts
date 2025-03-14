import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { MAX_TARGETS_FOR_READ_REQUEST } from '@graasp/sdk';

import { customType } from '../../../../../plugins/typebox.js';
import { errorSchemaRef } from '../../../../../schemas/global.js';
import { nullableMemberSchemaRef } from '../../../../member/schemas.js';
import { itemSchemaRef } from '../../../schemas.js';
import { packedItemSchemaRef } from '../../../schemas.packed.js';

const publishEntry = customType.StrictObject(
  {
    id: customType.UUID(),
    item: itemSchemaRef,
    creator: nullableMemberSchemaRef,
    createdAt: customType.DateTime(),
  },
  {
    description: 'Information of a published item',
  },
);

export const getCollectionsForMember = {
  operationId: 'getCollectionsForMember',
  tags: ['collection'],
  summary: 'Get collections for member',
  description: 'Get packed collections for member, used in the builder view of the member.',

  params: customType.StrictObject({
    memberId: customType.UUID(),
  }),

  response: {
    [StatusCodes.OK]: Type.Array(packedItemSchemaRef),
    '4xx': errorSchemaRef,
  },
};

export const publishItem = {
  operationId: 'publishItem',
  tags: ['collection'],
  summary: 'Publish an item',
  description: 'Publish an item. It will become listed in the Library.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: publishEntry,
    '4xx': errorSchemaRef,
  },
};

export const unpublishItem = {
  operationId: 'unpublishItem',
  tags: ['collection'],
  summary: 'Unpublish an item',
  description: 'Unpublish an item. It will stop being available in the Library.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: Type.Null(),
    '4xx': errorSchemaRef,
  },
};

export const getInformations = {
  operationId: 'getCollectionInformations',
  tags: ['collection'],
  summary: 'Get information of a collection',
  description: 'Get information of a collection, including views count.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: customType.Nullable(
      Type.Composite([publishEntry, customType.StrictObject({ totalViews: Type.Number() })]),
    ),
    '4xx': errorSchemaRef,
  },
};

export const getManyInformations = {
  querystring: customType.StrictObject({
    itemId: Type.Array(customType.UUID(), {
      uniqueItems: true,
      maxItems: MAX_TARGETS_FOR_READ_REQUEST,
    }),
  }),
  response: {
    [StatusCodes.OK]: customType.StrictObject({
      data: Type.Record(Type.String({ format: 'uuid' }), publishEntry),
      errors: Type.Array(errorSchemaRef),
    }),
  },
};
