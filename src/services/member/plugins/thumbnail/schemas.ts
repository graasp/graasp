import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { ThumbnailSize } from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';

export const upload = {
  response: { [StatusCodes.NO_CONTENT]: Type.Null() },
} as const satisfies FastifySchema;

export const download = {
  params: Type.Object(
    {
      id: customType.UUID(),
      size: Type.Enum(ThumbnailSize, { default: ThumbnailSize.Medium }),
    },
    { additionalProperties: false },
  ),
  querystring: Type.Object(
    {
      replyUrl: Type.Boolean({ default: false }),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: errorSchemaRef,
    '4xx': errorSchemaRef,
    [StatusCodes.INTERNAL_SERVER_ERROR]: errorSchemaRef,
  },
} as const satisfies FastifySchema;
