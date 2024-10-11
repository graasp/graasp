import { Type } from '@sinclair/typebox';

import { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox';
import { itemIdSchemaRef } from '../../schema';

export const zipImport = {
  querystring: Type.Partial(
    Type.Object(
      {
        parentId: customType.UUID(),
      },
      {
        additionalProperties: false,
      },
    ),
  ),
} as const satisfies FastifySchema;

export const zipExport = {
  params: itemIdSchemaRef,
} as const satisfies FastifySchema;
