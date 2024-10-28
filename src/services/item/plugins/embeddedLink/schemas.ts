import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { errorSchemaRef } from '../../../../schemas/global';

export const getLinkMetadata = {
  querystring: Type.Partial(
    Type.Object(
      { link: Type.String({ format: 'uri-reference' }) },
      { additionalProperties: false },
    ),
  ),
  response: {
    [StatusCodes.OK]: Type.Object(
      {
        title: Type.Optional(Type.String()),
        description: Type.Optional(Type.String()),
        html: Type.Optional(Type.String()),
        isEmbeddingAllowed: Type.Boolean(),
        icons: Type.Array(Type.String()),
        thumbnails: Type.Array(Type.String()),
      },
      { additionalProperties: false },
    ),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
