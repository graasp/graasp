import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';

export const getLinkMetadata = {
  operationId: 'getLinkMetadata',
  tags: ['item', 'link'],
  summary: 'Get metadata information from iframely for given url',
  description: 'Get metadata information from iframely for given url.',

  querystring: Type.Partial(
    customType.StrictObject({ link: Type.String({ format: 'uri-reference' }) }),
  ),
  response: {
    [StatusCodes.OK]: customType.StrictObject({
      title: Type.Optional(Type.String()),
      description: Type.Optional(Type.String()),
      html: Type.Optional(Type.String()),
      isEmbeddingAllowed: Type.Boolean(),
      icons: Type.Array(Type.String()),
      thumbnails: Type.Array(Type.String()),
    }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
