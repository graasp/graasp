// we need this file used in classic json schema
import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { customType, registerSchemaAsRef } from '../plugins/typebox';

export const errorSchemaRef = registerSchemaAsRef(
  'error',
  'Error',
  customType.StrictObject(
    {
      name: Type.Optional(Type.String()),
      code: Type.Optional(
        Type.Union([
          Type.Number({
            minimum: 400,
            maximum: 599,
            examples: [StatusCodes.INTERNAL_SERVER_ERROR],
          }),
          Type.String(),
        ]),
      ),
      message: Type.String(),
      statusCode: Type.Optional(Type.Number()),
      data: Type.Optional(Type.Any()),
      origin: Type.Optional(Type.String()),
    },
    {
      description:
        'Error object with useful information about the unexpected behavior that occured',
    },
  ),
);
