import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { ThumbnailSize } from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';

export const upload = {
  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
    [StatusCodes.INTERNAL_SERVER_ERROR]: errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const download = {
  operationId: 'downloadItemThumbnail',
  tags: ['item', 'thumbnail'],
  summary: "Get an item's thumbnail",
  description:
    "Get an item's thumbnail at given size. The return value is null if the item did not previously have a thumbnail.",

  params: customType.StrictObject({
    id: customType.UUID(),
    size: Type.Enum(ThumbnailSize, { default: ThumbnailSize.Medium }),
  }),
  response: {
    [StatusCodes.OK]: customType.Nullable(
      Type.String({ description: 'Url string of the thumbnail, null if it does not exist' }),
    ),
    '4xx': errorSchemaRef,
    [StatusCodes.INTERNAL_SERVER_ERROR]: errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteSchema = {
  params: customType.StrictObject({
    id: customType.UUID(),
  }),
} as const satisfies FastifySchema;
