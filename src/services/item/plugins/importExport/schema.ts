import { Type } from '@sinclair/typebox';

import { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox';

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
  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
} as const satisfies FastifySchema;
