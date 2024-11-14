import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { MAX_TARGETS_FOR_READ_REQUEST } from '@graasp/sdk';

import { customType } from '../../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../../schemas/global';
import {
  GET_MOST_LIKED_ITEMS_MAXIMUM,
  GET_MOST_RECENT_ITEMS_MAXIMUM,
} from '../../../../../utils/config';
import { nullableMemberSchemaRef } from '../../../../member/schemas';
import { itemSchemaRef } from '../../../schemas';
import { packedItemSchemaRef } from '../../../schemas.packed';

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

export const getRecentCollections = {
  operationId: 'getRecentCollections',
  tags: ['collection'],
  summary: 'Get most recent published items',
  description: 'Get most recent published items (collections)',

  querystring: customType.StrictObject({
    limit: Type.Number({
      maximum: GET_MOST_RECENT_ITEMS_MAXIMUM,
      minimum: 1,
      default: GET_MOST_RECENT_ITEMS_MAXIMUM,
    }),
  }),

  response: {
    [StatusCodes.OK]: Type.Array(itemSchemaRef),
    '4xx': errorSchemaRef,
  },
};

export const getMostLikedItems = {
  operationId: 'getMostLikedCollections',
  tags: ['collection'],
  summary: 'Get most liked items',
  description: 'Get most liked items (collections)',

  querystring: customType.StrictObject({
    limit: Type.Number({
      maximum: GET_MOST_LIKED_ITEMS_MAXIMUM,
      minimum: 1,
      default: GET_MOST_LIKED_ITEMS_MAXIMUM,
    }),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(itemSchemaRef),
    '4xx': errorSchemaRef,
  },
};

export const getCollectionsForMember = {
  operationId: 'getCollectionsForMember',
  tags: ['collection'],
  summary: 'Get collections for member',
  description: 'Get collections for member.',

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
  description: 'Publish an item, that will become listed in the Library.',

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
  description: 'Unpublish an item, that will not be available anymore on the Library.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: publishEntry,
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
  querystring: Type.Object(
    {
      itemId: Type.Array(customType.UUID(), {
        uniqueItems: true,
        maxItems: MAX_TARGETS_FOR_READ_REQUEST,
      }),
    },
    {
      additionalProperties: false,
    },
  ),
  response: {
    [StatusCodes.OK]: Type.Object(
      {
        data: Type.Record(Type.String({ format: 'uuid' }), publishEntry),
        errors: Type.Array(errorSchemaRef),
      },
      { additionalProperties: false },
    ),
  },
};
