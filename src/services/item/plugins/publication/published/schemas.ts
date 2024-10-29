import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { MAX_TARGETS_FOR_READ_REQUEST } from '@graasp/sdk';

import { customType } from '../../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../../schemas/global';
import {
  GET_MOST_LIKED_ITEMS_MAXIMUM,
  GET_MOST_RECENT_ITEMS_MAXIMUM,
} from '../../../../../utils/config';
import { LIST_OF_UUID_V4_REGEX_PATTERN } from '../../../../../utils/constants';
import { nullableMemberSchemaRef } from '../../../../member/schemas';
import { itemIdSchemaRef, itemSchemaRef } from '../../../schemas';
import { packedItemSchemaRef } from '../../../schemas.packed';

const publishEntry = Type.Object(
  {
    id: customType.UUID(),
    item: itemSchemaRef,
    creator: nullableMemberSchemaRef,
    createdAt: customType.DateTime(),
  },
  {
    additionalProperties: false,
  },
);

const publishEntryWithViews = Type.Object(
  {
    id: customType.UUID(),
    item: itemSchemaRef,
    creator: nullableMemberSchemaRef,
    createdAt: customType.DateTime(),
    totalViews: Type.Number(),
  },
  {
    additionalProperties: false,
  },
);

export const getCollections = {
  querystring: {
    type: 'object',
    properties: {
      categoryId: {
        type: 'array',
        items: Type.String({
          pattern: LIST_OF_UUID_V4_REGEX_PATTERN,
        }),
        maxItems: MAX_TARGETS_FOR_READ_REQUEST,
      },
    },
  },

  response: {
    [StatusCodes.OK]: Type.Array(itemSchemaRef),
  },
};

export const getRecentCollections = {
  querystring: Type.Object(
    {
      limit: Type.Number({
        maximum: GET_MOST_RECENT_ITEMS_MAXIMUM,
        minimum: 1,
        default: GET_MOST_RECENT_ITEMS_MAXIMUM,
      }),
    },
    { additionalProperties: false },
  ),

  response: {
    [StatusCodes.OK]: Type.Array(itemSchemaRef),
  },
};

export const getMostLikedItems = {
  querystring: Type.Object(
    {
      limit: Type.Number({
        maximum: GET_MOST_LIKED_ITEMS_MAXIMUM,
        minimum: 1,
        default: GET_MOST_LIKED_ITEMS_MAXIMUM,
      }),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: Type.Array(itemSchemaRef),
  },
};

export const getCollectionsForMember = {
  params: Type.Object(
    {
      memberId: customType.UUID(),
    },
    { additionalProperties: false },
  ),

  response: {
    [StatusCodes.OK]: Type.Array(packedItemSchemaRef),
  },
};

export const publishItem = {
  params: itemIdSchemaRef,
  response: {
    [StatusCodes.OK]: publishEntry,
  },
};

export const unpublishItem = {
  params: itemIdSchemaRef,
  response: {
    [StatusCodes.OK]: publishEntry,
  },
};

export const getInformations = {
  params: itemIdSchemaRef,
  response: {
    [StatusCodes.OK]: customType.Nullable(publishEntryWithViews),
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
