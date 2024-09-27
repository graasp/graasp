// we need this file used in classic json schema
// duplicate of shared fluent-schema.ts
import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { customType, registerSchemaAsRef } from '../plugins/typebox';

export const UUID_REGEX =
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
export const NAME_REGEX = '^\\S+( \\S+)*$';
// allow empty strings or words separated by one space
export const EMPTY_OR_SPACED_WORDS_REGEX = /^(\S+( \S+)*)?$/;

export const entityIdSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object Definition
      id: customType.UUID(),
    },
    {
      // Schema Options
      title: 'Entity ID',
      $id: 'entityId',
      additionalProperties: false,
    },
  ),
);

export const errorSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object Definition
      name: Type.Optional(Type.String()),
      code: Type.Union([
        Type.Number({
          minimum: 400,
          maximum: 599,
          examples: [StatusCodes.INTERNAL_SERVER_ERROR],
        }),
        Type.String(),
      ]),
      message: Type.String(),
      statusCode: Type.Number(),
      data: Type.Optional(Type.Any()),
      origin: Type.Optional(Type.String()),
    },
    {
      // Schema Options
      title: 'Error',
      $id: 'error',
      additionalProperties: false,
    },
  ),
);
